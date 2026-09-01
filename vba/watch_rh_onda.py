"""
watch_rh_onda.py — Synchronisation AUTOMATIQUE Excel -> plateforme RH ONDA.

Surveille les fichiers Excel RH : dès que vous les enregistrez dans Excel, les
données sont automatiquement poussées vers l'API.

Fichiers surveillés :
  • modele_import_employes.xlsx      -> /api/employes/bulk-sync
  • Tableau de Suivi de Formation…   -> /api/cours/bulk-sync
                                        puis /api/suivi-formation/bulk-sync

En parallèle, un instantané des employés est régénéré dans un fichier *séparé*
(modele_import_employes_export.xlsx) à intervalle régulier.

Décisions d'architecture (voir README) :
  • Sens : Excel -> plateforme en temps réel (sur enregistrement), un seul sens.
  • « Excel fait foi » : en cas de conflit, la valeur du .xlsx gagne.
  • On n'écrit JAMAIS dans les fichiers surveillés (ouverts dans Excel = verrou,
    et écrire détruirait graphiques/macros). Le statut va dans `watch.log`.
  • Le fichier de formation identifie les collaborateurs par NOM (texte libre) :
    le serveur tente de les rapprocher et signale ceux qui ne correspondent pas
    (« employés introuvables ») dans le journal — corrigez le nom puis ré-enregistrez.
  • Les classeurs à graphiques du rapport PS09 ne sont PAS surveillés (VBA only).

Configuration : copier `watch_config.example.ini` en `watch_config.ini`.

Usage :
    python watch_rh_onda.py

Dépendances : pip install watchdog openpyxl requests
"""

from __future__ import annotations

import configparser
import hashlib
import logging
import os
import sys
import threading
import time
from pathlib import Path

import openpyxl
import requests
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from export_rh_onda import export_employes
from sync_rh_onda import (
    DEFAULT_API_URL,
    EMPLOYES_FILE,
    FORMATION_FILE,
    SyncError,
    api_post_auth,
    login,
    read_cours_rows,
    read_employe_rows,
    read_suivi_rows,
)

HERE = Path(__file__).resolve().parent
CONFIG_FILE = HERE / "watch_config.ini"
LOG_FILE = HERE / "watch.log"

DEBOUNCE_SECONDS = 2.5          # attente après le dernier enregistrement
READ_RETRIES = 5               # relectures si le fichier est en cours d'écriture
READ_RETRY_DELAY = 0.6

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%d/%m/%Y %H:%M:%S",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("watch_rh_onda")


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

class Config:
    def __init__(self) -> None:
        parser = configparser.ConfigParser()
        if CONFIG_FILE.exists():
            parser.read(CONFIG_FILE, encoding="utf-8")
        section = parser["rh_onda"] if parser.has_section("rh_onda") else {}

        def flag(env, key, default):
            return str(os.getenv(env) or section.get(key, default)).strip().lower() in ("1", "true", "yes", "oui")

        self.api_url = os.getenv("RH_API_URL") or section.get("api_url") or DEFAULT_API_URL
        self.matricule = os.getenv("RH_MATRICULE") or section.get("matricule") or ""
        self.password = os.getenv("RH_PASSWORD") or section.get("password") or ""
        self.export_interval_min = int(
            os.getenv("RH_EXPORT_INTERVAL_MIN") or section.get("export_interval_min", "10")
        )
        self.export_enabled = flag("RH_EXPORT_ENABLED", "export_enabled", "true")
        self.watch_employes = flag("RH_WATCH_EMPLOYES", "watch_employes", "true")
        self.watch_formation = flag("RH_WATCH_FORMATION", "watch_formation", "true")

    def validate(self) -> None:
        if not self.matricule or not self.password:
            raise SyncError(
                "matricule / mot de passe manquants. Copiez watch_config.example.ini "
                "en watch_config.ini et renseignez vos identifiants (ou définissez "
                "RH_MATRICULE / RH_PASSWORD)."
            )


# ---------------------------------------------------------------------------
# Session API (token en mémoire + re-login automatique sur 401)
# ---------------------------------------------------------------------------

class ApiSession:
    def __init__(self, config: Config) -> None:
        self.config = config
        self._token: str | None = None
        self._lock = threading.Lock()

    def _ensure_token(self) -> str:
        with self._lock:
            if self._token is None:
                self._token = login(self.config.api_url, self.config.matricule, self.config.password)
                log.info("Connexion API réussie (matricule %s).", self.config.matricule)
            return self._token

    def _invalidate(self) -> None:
        with self._lock:
            self._token = None

    def post(self, endpoint: str, payload: dict) -> requests.Response:
        token = self._ensure_token()
        resp = api_post_auth(self.config.api_url, endpoint, token, payload)
        if resp.status_code == 401:
            log.warning("Session expirée (401) — reconnexion...")
            self._invalidate()
            token = self._ensure_token()
            resp = api_post_auth(self.config.api_url, endpoint, token, payload)
        return resp

    def token(self) -> str:
        return self._ensure_token()

    def refresh_token(self) -> str:
        self._invalidate()
        return self._ensure_token()


# ---------------------------------------------------------------------------
# Lecture tolérante (fichier possiblement en cours d'écriture par Excel)
# ---------------------------------------------------------------------------

def _file_hash(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _read_rows_with_retry(path: Path, sheet: str, reader) -> list[dict]:
    """Charge une feuille en tolérant un fichier en cours d'écriture par Excel."""
    last_exc: Exception | None = None
    for attempt in range(1, READ_RETRIES + 1):
        try:
            wb = openpyxl.load_workbook(path, data_only=True, read_only=False)
            ws = wb[sheet]
            rows, _ = reader(ws)
            wb.close()
            return rows
        except (PermissionError, OSError, KeyError) as exc:
            last_exc = exc
            log.debug("Lecture %s/%s tentative %d/%d : %s", path.name, sheet, attempt, READ_RETRIES, exc)
            time.sleep(READ_RETRY_DELAY)
    raise SyncError(f"Lecture impossible ({path.name} / {sheet}) après {READ_RETRIES} tentatives : {last_exc}")


# ---------------------------------------------------------------------------
# Processeurs de synchronisation (un par workbook)
# ---------------------------------------------------------------------------

def _post_and_log(session: ApiSession, tag: str, endpoint: str, key: str, rows: list[dict], describe) -> None:
    if not rows:
        log.info("[%s] aucune ligne à synchroniser.", tag)
        return
    log.info("[%s] envoi de %d ligne(s)...", tag, len(rows))
    resp = session.post(endpoint, {key: rows})
    if resp.status_code == 200:
        describe(resp.json())
    elif resp.status_code == 422:
        log.error("[%s] ❌ validation rejetée : %s", tag, resp.text)
    else:
        log.error("[%s] ❌ erreur serveur (%s) : %s", tag, resp.status_code, resp.text)


def process_employes(session: ApiSession) -> None:
    rows = _read_rows_with_retry(EMPLOYES_FILE, "EMPLOYES", read_employe_rows)
    _post_and_log(
        session, "employes", "/employes/bulk-sync", "employes", rows,
        lambda d: log.info(
            "[employes] ✅ créés=%s modifiés=%s erreurs=%s",
            d.get("created"), d.get("modified", d.get("updated")), d.get("errors"),
        ),
    )


def process_formation(session: ApiSession) -> None:
    # 1) Cours (doit précéder le suivi, qui référence les cours)
    cours = _read_rows_with_retry(FORMATION_FILE, "Liste des Cours", read_cours_rows)
    _post_and_log(
        session, "cours", "/cours/bulk-sync", "cours", cours,
        lambda d: log.info("[cours] ✅ créés=%s mis_à_jour=%s", d.get("created"), d.get("updated")),
    )

    # 2) Suivi de formation (rapproche les collaborateurs par nom)
    suivi = _read_rows_with_retry(FORMATION_FILE, "Suivi de Formation", read_suivi_rows)

    def describe_suivi(d):
        introuvables = d.get("employes_introuvables") or 0
        log.info(
            "[suivi] ✅ total=%s rapprochés=%s introuvables=%s",
            d.get("total"), d.get("employes_matched"), introuvables,
        )
        if introuvables:
            log.warning(
                "[suivi] ⚠️ %s collaborateur(s) non rapproché(s) — corrigez l'orthographe "
                "du nom dans Excel (feuille 'Suivi de Formation') puis ré-enregistrez.",
                introuvables,
            )

    _post_and_log(session, "suivi", "/suivi-formation/bulk-sync", "lignes", suivi, describe_suivi)


# ---------------------------------------------------------------------------
# Runner (debounce + garde par hash) — un par workbook
# ---------------------------------------------------------------------------

class SyncRunner:
    def __init__(self, name: str, path: Path, process_fn) -> None:
        self.name = name
        self.path = path
        self.process_fn = process_fn
        self._last_hash: str | None = None
        self._timer: threading.Timer | None = None
        self._lock = threading.Lock()

    def schedule(self) -> None:
        with self._lock:
            if self._timer is not None:
                self._timer.cancel()
            self._timer = threading.Timer(DEBOUNCE_SECONDS, self._run)
            self._timer.daemon = True
            self._timer.start()

    def _run(self) -> None:
        try:
            if not self.path.exists():
                log.warning("[%s] fichier introuvable : %s", self.name, self.path)
                return

            current_hash = _file_hash(self.path)
            if current_hash == self._last_hash:
                log.info("[%s] aucun changement réel (hash identique) — ignoré.", self.name)
                return

            log.info("[%s] enregistrement détecté — synchronisation...", self.name)
            self.process_fn()
            self._last_hash = current_hash
        except SyncError as exc:
            log.error("[%s] ❌ %s", self.name, exc)
        except Exception as exc:  # noqa: BLE001 - le watcher ne doit jamais mourir
            log.exception("[%s] ❌ erreur inattendue : %s", self.name, exc)


# ---------------------------------------------------------------------------
# Handler watchdog — route les événements par nom de fichier
# ---------------------------------------------------------------------------

class WorkbookHandler(FileSystemEventHandler):
    def __init__(self, runners_by_name: dict[str, SyncRunner]) -> None:
        self.by_name = runners_by_name

    def _match(self, path: str) -> SyncRunner | None:
        name = os.path.basename(path)
        if name.startswith("~$") or name.endswith(".tmp"):
            return None  # fichiers temporaires de verrou Excel
        return self.by_name.get(name)

    def on_modified(self, event):
        if not event.is_directory:
            runner = self._match(event.src_path)
            if runner:
                runner.schedule()

    def on_created(self, event):
        if not event.is_directory:
            runner = self._match(event.src_path)
            if runner:
                runner.schedule()

    def on_moved(self, event):
        # Excel enregistre souvent via un fichier temporaire renommé vers la cible.
        dest = getattr(event, "dest_path", "")
        if dest:
            runner = self._match(dest)
            if runner:
                runner.schedule()


# ---------------------------------------------------------------------------
# Thread d'export (plateforme -> fichier séparé) sur intervalle
# ---------------------------------------------------------------------------

def export_loop(session: ApiSession, interval_min: int, stop: threading.Event) -> None:
    interval = max(1, interval_min) * 60
    while not stop.is_set():
        try:
            token = session.token()
            try:
                count = export_employes(session.config.api_url, token)
            except SyncError as exc:
                if str(exc) == "401":
                    token = session.refresh_token()
                    count = export_employes(session.config.api_url, token)
                else:
                    raise
            log.info("📤 Instantané plateforme -> Excel : %d employé(s) exporté(s).", count)
        except SyncError as exc:
            log.error("Export échoué : %s", exc)
        except Exception as exc:  # noqa: BLE001
            log.exception("Erreur inattendue durant l'export : %s", exc)
        stop.wait(interval)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    config = Config()
    try:
        config.validate()
    except SyncError as exc:
        log.error("%s", exc)
        return 1

    session = ApiSession(config)
    try:
        session.token()  # échoue vite si les identifiants sont mauvais
    except SyncError as exc:
        log.error("Connexion impossible : %s", exc)
        return 1

    runners: dict[str, SyncRunner] = {}
    watch_dirs: set[Path] = set()

    if config.watch_employes:
        if EMPLOYES_FILE.exists():
            runners[EMPLOYES_FILE.name] = SyncRunner(
                "employes", EMPLOYES_FILE, lambda: process_employes(session)
            )
            watch_dirs.add(EMPLOYES_FILE.parent)
            log.info("👀 Surveillance employés : %s", EMPLOYES_FILE)
        else:
            log.warning("Fichier employés introuvable — surveillance désactivée : %s", EMPLOYES_FILE)

    if config.watch_formation:
        if FORMATION_FILE.exists():
            runners[FORMATION_FILE.name] = SyncRunner(
                "formation", FORMATION_FILE, lambda: process_formation(session)
            )
            watch_dirs.add(FORMATION_FILE.parent)
            log.info("👀 Surveillance formation : %s", FORMATION_FILE)
        else:
            log.warning("Fichier formation introuvable — surveillance désactivée : %s", FORMATION_FILE)

    if not runners:
        log.error("Aucun fichier à surveiller (vérifiez la config et l'existence des fichiers).")
        return 1

    handler = WorkbookHandler(runners)
    observer = Observer()
    for directory in watch_dirs:
        observer.schedule(handler, str(directory), recursive=False)
    observer.start()

    stop = threading.Event()
    if config.export_enabled:
        export_thread = threading.Thread(
            target=export_loop, args=(session, config.export_interval_min, stop), daemon=True
        )
        export_thread.start()
        log.info("📤 Export plateforme -> Excel actif (toutes les %d min).", config.export_interval_min)

    log.info("Prêt. Enregistrez un fichier dans Excel pour déclencher une synchro. (Ctrl+C pour arrêter.)")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        log.info("Arrêt demandé...")
    finally:
        stop.set()
        observer.stop()
        observer.join()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
