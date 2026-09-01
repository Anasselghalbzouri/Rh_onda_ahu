"""
sync_rh_onda.py — Synchronise Excel <-> API RH ONDA en un seul script Python.

Remplace/complete les macros VBA (RH_Login.bas, RH_Sync.bas, RH_Cours.bas,
RH_SuiviFormation.bas) pour ceux qui préfèrent un script plutôt que des
macros Excel. Couvre les 3 workflows :

  1) Employes : modele_import_employes.xlsx (feuille EMPLOYES)
                -> POST /api/employes/bulk-sync
  2) Cours    : Tableau de Suivi de Formation siège.xlsx (feuille "Liste des Cours")
                -> POST /api/cours/bulk-sync
  3) Suivi    : Tableau de Suivi de Formation siège.xlsx (feuille "Suivi de Formation")
                -> POST /api/suivi-formation/bulk-sync (crée aussi le cours/la
                formation si besoin, et tente de retrouver le collaborateur
                par nom)

Le token est stocké/lu dans la feuille "RH_Config" de chaque classeur
(colonne A = clé, colonne B = valeur), comme les macros VBA du projet.

Usage :
    python sync_rh_onda.py --all
    python sync_rh_onda.py --employes
    python sync_rh_onda.py --cours
    python sync_rh_onda.py --suivi
    python sync_rh_onda.py --all --matricule 9519 --password "..." \
        --api-url http://127.0.0.1:8000/api

Dépendances : pip install openpyxl requests
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

import openpyxl
import requests
from openpyxl.styles import Font, PatternFill

GREEN_FILL = PatternFill("solid", fgColor="C8E6C9")
GREEN_FONT = Font(color="1B5E20")
ORANGE_FILL = PatternFill("solid", fgColor="FFE0B2")
RED_FILL = PatternFill("solid", fgColor="F8D7DA")
YELLOW_FILL = PatternFill("solid", fgColor="FFF9C4")

ROOT = Path(__file__).resolve().parent.parent
EMPLOYES_FILE = ROOT / "modele_import_employes.xlsx"
FORMATION_FILE = ROOT / "Tableau de Suivi de Formation siège.xlsx"

DEFAULT_API_URL = "http://127.0.0.1:8000/api"
CONFIG_SHEET = "RH_Config"


class SyncError(Exception):
    pass


# ---------------------------------------------------------------------------
# RH_Config (token) — clé/valeur en colonnes A/B, comme les macros VBA
# ---------------------------------------------------------------------------

def _read_config(ws) -> dict[str, object]:
    values = {}
    for row in ws.iter_rows(min_row=1, max_col=2):
        key = row[0].value
        if key:
            values[str(key).strip().upper()] = row[1].value
    return values


def _set_config_value(ws, key: str, value) -> None:
    for row in ws.iter_rows(min_row=1, max_col=2):
        if row[0].value and str(row[0].value).strip().upper() == key.upper():
            row[1].value = value
            return
    next_row = 1
    while ws.cell(row=next_row, column=1).value:
        next_row += 1
    ws.cell(row=next_row, column=1, value=key)
    ws.cell(row=next_row, column=2, value=value)


def get_or_create_config_sheet(wb):
    if CONFIG_SHEET in wb.sheetnames:
        return wb[CONFIG_SHEET]
    return wb.create_sheet(CONFIG_SHEET)


def login(api_url: str, matricule: str, password: str) -> str:
    resp = requests.post(
        f"{api_url}/login",
        json={"matricule": matricule, "password": password},
        timeout=15,
    )
    if resp.status_code != 200:
        raise SyncError(f"Echec de connexion ({resp.status_code}): {resp.text}")
    token = resp.json().get("token")
    if not token:
        raise SyncError("Connexion reussie mais aucun token recu.")
    return token


def get_token(wb, api_url: str, matricule: str | None, password: str | None) -> str:
    ws = get_or_create_config_sheet(wb)
    config = _read_config(ws)
    token = config.get("TOKEN")
    if token:
        return str(token)

    if not matricule or not password:
        raise SyncError(
            "Aucun token stocke dans ce classeur et aucun identifiant fourni "
            "(--matricule / --password)."
        )

    token = login(api_url, matricule, password)
    _set_config_value(ws, "TOKEN", token)
    _set_config_value(ws, "CONNEXION", datetime.now())
    _set_config_value(ws, "API_URL", api_url)
    return token


def clear_token(wb) -> None:
    ws = get_or_create_config_sheet(wb)
    _set_config_value(ws, "TOKEN", "")


def api_post_auth(api_url: str, endpoint: str, token: str, payload: dict) -> requests.Response:
    return requests.post(
        f"{api_url}{endpoint}",
        json=payload,
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
        timeout=60,
    )


def call_with_relogin(wb, api_url, endpoint, payload, matricule, password) -> requests.Response:
    token = get_token(wb, api_url, matricule, password)
    resp = api_post_auth(api_url, endpoint, token, payload)
    if resp.status_code == 401:
        clear_token(wb)
        if not matricule or not password:
            raise SyncError("Session expiree et aucun identifiant fourni pour se reconnecter.")
        token = get_token(wb, api_url, matricule, password)
        resp = api_post_auth(api_url, endpoint, token, payload)
    return resp


def backup(path: Path) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    dest = path.with_name(f"{path.stem}.backup-{stamp}{path.suffix}")
    shutil.copy2(path, dest)
    return dest


def save_workbook(wb, path: Path) -> None:
    try:
        wb.save(path)
    except PermissionError as exc:
        raise SyncError(
            f"Impossible d'enregistrer '{path.name}' — le fichier est probablement "
            "ouvert dans Excel. Fermez-le et relancez le script."
        ) from exc


# ---------------------------------------------------------------------------
# Workflow 1 — EMPLOYES
# ---------------------------------------------------------------------------

EMPLOYE_FIELDS = [
    "matricule", "nom", "prenom", "sexe", "date_naissance", "date_embauche",
    "categorie", "echelle", "echelon", "entite", "fonction", "qualification",
    "affectation", "date_affectation", "solde_conge", "statut", "observation",
]
COL_STATUT_SYNC_EMPLOYES = 18  # R


def _cell_to_value(cell):
    value = cell.value
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, str):
        value = value.strip()
        return value if value != "" else None
    return value


def read_employe_rows(ws) -> tuple[list[dict], list[int]]:
    """Lit la feuille EMPLOYES (sans effet de bord) et retourne (lignes, index).

    Réutilisé par le script CLI et par le watcher (watch_rh_onda.py). Ne modifie
    jamais le classeur — sûr à appeler pendant que le fichier est ouvert dans Excel.
    """
    rows = []
    row_indexes = []
    for r in range(2, ws.max_row + 1):
        mat = _cell_to_value(ws.cell(row=r, column=1))
        if not mat:
            continue
        row = {"matricule": str(mat)}
        for i, field in enumerate(EMPLOYE_FIELDS[1:], start=2):
            val = _cell_to_value(ws.cell(row=r, column=i))
            if val is not None:
                row[field] = val
        rows.append(row)
        row_indexes.append(r)
    return rows, row_indexes


def sync_employes(api_url: str, matricule: str | None, password: str | None, dry_run: bool) -> None:
    if not EMPLOYES_FILE.exists():
        raise SyncError(f"Fichier introuvable : {EMPLOYES_FILE}")

    wb = openpyxl.load_workbook(EMPLOYES_FILE)
    ws = wb["EMPLOYES"]

    rows, row_indexes = read_employe_rows(ws)

    if not rows:
        print("[employes] Aucune ligne avec matricule a synchroniser.")
        return

    print(f"[employes] {len(rows)} ligne(s) a envoyer...")

    if dry_run:
        print("[employes] --dry-run : aucun appel API effectue.")
        return

    resp = call_with_relogin(
        wb, api_url, "/employes/bulk-sync", {"employes": rows}, matricule, password
    )

    if resp.status_code == 200:
        data = resp.json()
        stamp = datetime.now().strftime("Sync OK %d/%m/%Y %H:%M")
        for r in row_indexes:
            cell = ws.cell(row=r, column=COL_STATUT_SYNC_EMPLOYES, value=stamp)
            cell.fill = GREEN_FILL
            cell.font = GREEN_FONT
        print(f"[employes] OK — crees={data.get('created')} mis_a_jour={data.get('updated')} "
              f"erreurs={data.get('errors')}")
    elif resp.status_code == 422:
        for r in row_indexes:
            ws.cell(row=r, column=COL_STATUT_SYNC_EMPLOYES, value="Erreur validation").fill = RED_FILL
        print(f"[employes] Erreur de validation : {resp.text}")
    else:
        for r in row_indexes:
            ws.cell(row=r, column=COL_STATUT_SYNC_EMPLOYES, value="Non envoye").fill = YELLOW_FILL
        print(f"[employes] Erreur serveur ({resp.status_code}) : {resp.text}")

    save_workbook(wb, EMPLOYES_FILE)


# ---------------------------------------------------------------------------
# Workflow 2 — LISTE DES COURS
# ---------------------------------------------------------------------------

COURS_HEADER_ROW = 6
COURS_DATA_START = 7
COURS_COL_THEME = 3       # C
COURS_COL_DESC = 4        # D
COURS_COL_DUREE = 5       # E
COURS_COL_STATUT = 6      # F


def _parse_duree_jours(raw) -> int | None:
    if raw is None:
        return None
    match = re.search(r"(\d+)", str(raw))
    return int(match.group(1)) if match else None


def read_cours_rows(ws) -> tuple[list[dict], list[int]]:
    """Lit la feuille 'Liste des Cours' (sans effet de bord). Réutilisé par le watcher."""
    rows = []
    row_indexes = []
    for r in range(COURS_DATA_START, ws.max_row + 1):
        theme = _cell_to_value(ws.cell(row=r, column=COURS_COL_THEME))
        if not theme:
            continue
        row = {"theme": str(theme)}
        desc = _cell_to_value(ws.cell(row=r, column=COURS_COL_DESC))
        if desc:
            row["description"] = str(desc)
        duree = _parse_duree_jours(ws.cell(row=r, column=COURS_COL_DUREE).value)
        if duree:
            row["duree_jours"] = duree
        rows.append(row)
        row_indexes.append(r)
    return rows, row_indexes


def sync_cours(api_url: str, matricule: str | None, password: str | None, dry_run: bool) -> None:
    if not FORMATION_FILE.exists():
        raise SyncError(f"Fichier introuvable : {FORMATION_FILE}")

    wb = openpyxl.load_workbook(FORMATION_FILE)
    ws = wb["Liste des Cours"]
    ws.cell(row=COURS_HEADER_ROW, column=COURS_COL_STATUT, value="STATUT_SYNC")

    rows, row_indexes = read_cours_rows(ws)

    if not rows:
        print("[cours] Aucune ligne avec theme a synchroniser.")
        save_workbook(wb, FORMATION_FILE)
        return

    print(f"[cours] {len(rows)} cours a envoyer...")

    if dry_run:
        print("[cours] --dry-run : aucun appel API effectue.")
        return

    resp = call_with_relogin(wb, api_url, "/cours/bulk-sync", {"cours": rows}, matricule, password)

    if resp.status_code == 200:
        data = resp.json()
        for r in row_indexes:
            cell = ws.cell(row=r, column=COURS_COL_STATUT, value="OK Synchro")
            cell.fill = GREEN_FILL
            cell.font = GREEN_FONT
        print(f"[cours] OK — crees={data.get('created')} mis_a_jour={data.get('updated')}")
    elif resp.status_code == 422:
        for r in row_indexes:
            ws.cell(row=r, column=COURS_COL_STATUT, value="Erreur validation").fill = RED_FILL
        print(f"[cours] Erreur de validation : {resp.text}")
    else:
        for r in row_indexes:
            ws.cell(row=r, column=COURS_COL_STATUT, value="Non envoye").fill = YELLOW_FILL
        print(f"[cours] Erreur serveur ({resp.status_code}) : {resp.text}")

    save_workbook(wb, FORMATION_FILE)


# ---------------------------------------------------------------------------
# Workflow 3 — SUIVI DE FORMATION
# ---------------------------------------------------------------------------

SUIVI_HEADER_ROW = 14
SUIVI_DATA_START = 15
SUIVI_COL_DATE = 3        # C
SUIVI_COL_COLLAB = 4      # D
SUIVI_COL_COURS = 5       # E
SUIVI_COL_SERVICE = 6     # F
SUIVI_COL_SUIVI = 7       # G
SUIVI_COL_REMARQUE = 8    # H
SUIVI_COL_STATUT = 9      # I

DATE_RE = re.compile(r"(\d{1,2})/(\d{1,2})/(\d{4})")


def _parse_date_range(raw) -> tuple[str | None, str | None]:
    if not raw:
        return None, None
    matches = DATE_RE.findall(str(raw))
    if not matches:
        return None, None

    def to_date(m):
        day, month, year = (int(x) for x in m)
        try:
            return datetime(year, month, day)
        except ValueError:
            return None

    dates = [d for d in (to_date(m) for m in matches[:2]) if d is not None]
    if not dates:
        return None, None
    if len(dates) == 1:
        dates.append(dates[0])
    d1, d2 = sorted(dates)
    return d1.strftime("%Y-%m-%d"), d2.strftime("%Y-%m-%d")


def read_suivi_rows(ws) -> tuple[list[dict], list[int]]:
    """Lit la feuille 'Suivi de Formation' (sans effet de bord). Réutilisé par le watcher."""
    rows = []
    row_indexes = []
    for r in range(SUIVI_DATA_START, ws.max_row + 1):
        collaborateur = _cell_to_value(ws.cell(row=r, column=SUIVI_COL_COLLAB))
        cours = _cell_to_value(ws.cell(row=r, column=SUIVI_COL_COURS))
        if not collaborateur or not cours:
            continue

        date_debut, date_fin = _parse_date_range(ws.cell(row=r, column=SUIVI_COL_DATE).value)
        service = _cell_to_value(ws.cell(row=r, column=SUIVI_COL_SERVICE))
        suivi_raw = _cell_to_value(ws.cell(row=r, column=SUIVI_COL_SUIVI))
        remarque = _cell_to_value(ws.cell(row=r, column=SUIVI_COL_REMARQUE))

        row = {
            "collaborateur": str(collaborateur),
            "cours": str(cours),
            "suivi": bool(suivi_raw) and str(suivi_raw).strip().upper() == "OUI",
        }
        if date_debut:
            row["date_debut"] = date_debut
        if date_fin:
            row["date_fin"] = date_fin
        if service:
            row["service"] = str(service)
        if remarque:
            row["remarque"] = str(remarque)

        rows.append(row)
        row_indexes.append(r)
    return rows, row_indexes


def sync_suivi_formation(api_url: str, matricule: str | None, password: str | None, dry_run: bool) -> None:
    if not FORMATION_FILE.exists():
        raise SyncError(f"Fichier introuvable : {FORMATION_FILE}")

    wb = openpyxl.load_workbook(FORMATION_FILE)
    ws = wb["Suivi de Formation"]
    ws.cell(row=SUIVI_HEADER_ROW, column=SUIVI_COL_STATUT, value="STATUT_SYNC")

    rows, row_indexes = read_suivi_rows(ws)

    if not rows:
        print("[suivi] Aucune ligne complete (collaborateur + cours) a synchroniser.")
        save_workbook(wb, FORMATION_FILE)
        return

    print(f"[suivi] {len(rows)} ligne(s) a envoyer...")

    if dry_run:
        print("[suivi] --dry-run : aucun appel API effectue.")
        return

    resp = call_with_relogin(
        wb, api_url, "/suivi-formation/bulk-sync", {"lignes": rows}, matricule, password
    )

    if resp.status_code == 200:
        data = resp.json()
        results = data.get("results", [])
        for r, result in zip(row_indexes, results):
            if result.get("employe_status") == "matched":
                cell = ws.cell(row=r, column=SUIVI_COL_STATUT, value="OK Synchro")
                cell.fill = GREEN_FILL
                cell.font = GREEN_FONT
            else:
                ws.cell(row=r, column=SUIVI_COL_STATUT, value="Employe non trouve").fill = ORANGE_FILL
        print(
            f"[suivi] OK — total={data.get('total')} "
            f"employes_matched={data.get('employes_matched')} "
            f"employes_introuvables={data.get('employes_introuvables')}"
        )
        if data.get("employes_introuvables"):
            print("[suivi] Corrigez le nom des collaborateurs marques 'Employe non trouve' puis relancez.")
    elif resp.status_code == 422:
        for r in row_indexes:
            ws.cell(row=r, column=SUIVI_COL_STATUT, value="Erreur validation").fill = RED_FILL
        print(f"[suivi] Erreur de validation : {resp.text}")
    else:
        for r in row_indexes:
            ws.cell(row=r, column=SUIVI_COL_STATUT, value="Non envoye").fill = YELLOW_FILL
        print(f"[suivi] Erreur serveur ({resp.status_code}) : {resp.text}")

    save_workbook(wb, FORMATION_FILE)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Synchronise Excel <-> API RH ONDA")
    parser.add_argument("--all", action="store_true", help="Lance les 3 workflows dans l'ordre")
    parser.add_argument("--employes", action="store_true", help="Synchronise modele_import_employes.xlsx")
    parser.add_argument("--cours", action="store_true", help="Synchronise 'Liste des Cours'")
    parser.add_argument("--suivi", action="store_true", help="Synchronise 'Suivi de Formation'")
    parser.add_argument("--api-url", default=DEFAULT_API_URL, help=f"defaut: {DEFAULT_API_URL}")
    parser.add_argument("--matricule", default=None, help="Requis seulement si aucun token n'est deja stocke")
    parser.add_argument("--password", default=None)
    parser.add_argument("--no-backup", action="store_true", help="Ne pas creer de copie de sauvegarde avant ecriture")
    parser.add_argument("--dry-run", action="store_true", help="Analyse les fichiers sans appeler l'API ni les modifier")
    args = parser.parse_args()

    if not (args.all or args.employes or args.cours or args.suivi):
        parser.error("Choisir au moins un workflow : --all, --employes, --cours ou --suivi")

    do_employes = args.all or args.employes
    do_cours = args.all or args.cours
    do_suivi = args.all or args.suivi

    if not args.dry_run and not args.no_backup:
        if do_employes and EMPLOYES_FILE.exists():
            print(f"[backup] {backup(EMPLOYES_FILE).name}")
        if (do_cours or do_suivi) and FORMATION_FILE.exists():
            print(f"[backup] {backup(FORMATION_FILE).name}")

    try:
        if do_employes:
            sync_employes(args.api_url, args.matricule, args.password, args.dry_run)
        if do_cours:
            sync_cours(args.api_url, args.matricule, args.password, args.dry_run)
        if do_suivi:
            sync_suivi_formation(args.api_url, args.matricule, args.password, args.dry_run)
    except SyncError as exc:
        print(f"ERREUR : {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
