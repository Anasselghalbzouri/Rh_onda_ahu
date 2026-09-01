"""
export_rh_onda.py — Plateforme -> Excel (snapshot en lecture seule).

Récupère l'état courant des employés depuis l'API (`GET /api/employes`) et
l'écrit dans un classeur *séparé* :

    modele_import_employes_export.xlsx

⚠️  On n'écrit JAMAIS dans le fichier source `modele_import_employes.xlsx`
    (il peut être ouvert dans Excel = verrou), ni dans les classeurs à
    graphiques/macros (PS09, Tableau de Suivi) — ceux-ci restent gérés par VBA.

Ce fichier export est un *instantané* de la base : comme la politique retenue
est « Excel fait foi », il sert de vue de contrôle, pas de source à ré-importer.

Usage :
    python export_rh_onda.py --matricule 9519 --password "..."
    python export_rh_onda.py            # si un token est déjà en cache (watcher)

Dépendances : pip install openpyxl requests
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

import openpyxl
import requests
from openpyxl.styles import Alignment, Font, PatternFill

from sync_rh_onda import DEFAULT_API_URL, EMPLOYE_FIELDS, SyncError, login

ROOT = Path(__file__).resolve().parent.parent
EXPORT_FILE = ROOT / "modele_import_employes_export.xlsx"

HEADER_FILL = PatternFill("solid", fgColor="1E3A5F")
HEADER_FONT = Font(color="FFFFFF", bold=True)

# En-têtes lisibles, dans le même ordre de colonnes que le fichier d'import.
HEADER_LABELS = {
    "matricule": "MATRICULE",
    "nom": "NOM",
    "prenom": "PRENOM",
    "sexe": "SEXE",
    "date_naissance": "DATE_NAISSANCE",
    "date_embauche": "DATE_EMBAUCHE",
    "categorie": "CATEGORIE",
    "echelle": "ECHELLE",
    "echelon": "ECHELON",
    "entite": "ENTITE",
    "fonction": "FONCTION",
    "qualification": "QUALIFICATION",
    "affectation": "AFFECTATION",
    "date_affectation": "DATE_AFFECTATION",
    "solde_conge": "SOLDE_CONGE",
    "statut": "STATUT",
    "observation": "OBSERVATION",
}


def fetch_all_employes(api_url: str, token: str) -> list[dict]:
    """Parcourt toutes les pages de GET /api/employes et retourne la liste plate."""
    employes: list[dict] = []
    page = 1
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    while True:
        resp = requests.get(
            f"{api_url}/employes",
            params={"per_page": 200, "page": page},
            headers=headers,
            timeout=60,
        )
        if resp.status_code == 401:
            raise SyncError("401")  # signal de re-login géré par l'appelant
        if resp.status_code != 200:
            raise SyncError(f"Erreur API ({resp.status_code}) : {resp.text}")

        payload = resp.json()
        data = payload.get("data", [])
        employes.extend(data)

        last_page = payload.get("last_page", page)
        if page >= last_page or not data:
            break
        page += 1
    return employes


def write_export(employes: list[dict]) -> Path:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "EMPLOYES"

    fields = EMPLOYE_FIELDS  # ordre canonique matricule..observation

    # Ligne 1 — en-têtes
    for c, field in enumerate(fields, start=1):
        cell = ws.cell(row=1, column=c, value=HEADER_LABELS.get(field, field.upper()))
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center")

    # Lignes de données
    for r, emp in enumerate(employes, start=2):
        for c, field in enumerate(fields, start=1):
            value = emp.get(field)
            ws.cell(row=r, column=c, value=value)

    # Métadonnée : horodatage de l'instantané (feuille dédiée, pas de pollution)
    meta = wb.create_sheet("_export_info")
    meta["A1"] = "Instantané généré le"
    meta["B1"] = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    meta["A2"] = "Nombre d'employés"
    meta["B2"] = len(employes)
    meta["A3"] = "Source"
    meta["B3"] = "Base de données plateforme RH ONDA (lecture seule)"

    # Largeurs de colonnes approximatives
    for c in range(1, len(fields) + 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(c)].width = 16

    ws.freeze_panes = "A2"

    try:
        wb.save(EXPORT_FILE)
    except PermissionError as exc:
        raise SyncError(
            f"Impossible d'écrire '{EXPORT_FILE.name}' — il est probablement ouvert "
            "dans Excel. Fermez-le et relancez."
        ) from exc
    return EXPORT_FILE


def export_employes(api_url: str, token: str) -> int:
    """Récupère et écrit l'instantané. Retourne le nombre d'employés exportés."""
    employes = fetch_all_employes(api_url, token)
    write_export(employes)
    return len(employes)


def main() -> int:
    parser = argparse.ArgumentParser(description="Exporte les employés de la plateforme vers un classeur séparé")
    parser.add_argument("--api-url", default=DEFAULT_API_URL)
    parser.add_argument("--matricule", default=None)
    parser.add_argument("--password", default=None)
    args = parser.parse_args()

    if not args.matricule or not args.password:
        print("ERREUR : --matricule et --password sont requis en mode autonome.", file=sys.stderr)
        return 1

    try:
        token = login(args.api_url, args.matricule, args.password)
        count = export_employes(args.api_url, token)
    except SyncError as exc:
        print(f"ERREUR : {exc}", file=sys.stderr)
        return 1

    print(f"[export] OK — {count} employé(s) écrit(s) dans {EXPORT_FILE.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
