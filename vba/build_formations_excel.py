"""
Génère RH_Formations_ONDA.xlsx — fichier structuré pour le suivi des formations.
Feuilles : Programme Annuel | Suivi de Formation | Liste des Cours | Collaborateurs | RH_Config (cachée)
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

import pymysql
from openpyxl import Workbook
from openpyxl.styles import (
    PatternFill, Font, Alignment, Border, Side, GradientFill
)
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from datetime import date

# ─── Palette couleurs ──────────────────────────────────────────────────────────
C_HEADER_BG   = "1A3A5C"   # bleu marine
C_HEADER_FG   = "FFFFFF"
C_SUBHD_BG    = "2E6DA4"   # bleu moyen
C_STRIPE_ODD  = "EBF2FA"   # bleu très clair
C_STRIPE_EVEN = "FFFFFF"
C_PREVU       = "FFF3CD"   # jaune pâle  (x = prévu)
C_REALISE     = "D4EDDA"   # vert pâle   (● = réalisé)
C_MOIS_HDR    = "34495E"   # ardoise
C_ACTIF_FG    = "155724"
C_ACTIF_BG    = "D4EDDA"
C_INACT_FG    = "721C24"
C_INACT_BG    = "F8D7DA"
C_BORDER      = "BDC3C7"

YEAR = date.today().year
MOIS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"]

# ─── Helpers styles ────────────────────────────────────────────────────────────
def fill(hex_color):
    return PatternFill("solid", fgColor=hex_color)

def font(bold=False, color="000000", size=10, italic=False):
    return Font(bold=bold, color=color, size=size, italic=italic, name="Calibri")

def align(h="left", v="center", wrap=False):
    return Alignment(horizontal=h, vertical=v, wrap_text=wrap)

def thin_border():
    s = Side(style="thin", color=C_BORDER)
    return Border(left=s, right=s, top=s, bottom=s)

def header_cell(ws, row, col, value, bg=C_HEADER_BG, fg=C_HEADER_FG, sz=10, bold=True, h="center"):
    c = ws.cell(row=row, column=col, value=value)
    c.fill = fill(bg)
    c.font = font(bold=bold, color=fg, size=sz)
    c.alignment = align(h=h, wrap=True)
    c.border = thin_border()
    return c

def data_cell(ws, row, col, value=None, bg=None, bold=False, h="left", wrap=False, fg="000000"):
    c = ws.cell(row=row, column=col, value=value)
    if bg:
        c.fill = fill(bg)
    c.font = font(bold=bold, color=fg)
    c.alignment = align(h=h, wrap=wrap)
    c.border = thin_border()
    return c

# ─── Connexion DB ──────────────────────────────────────────────────────────────
conn = pymysql.connect(
    host="127.0.0.1", port=3306, user="root",
    password="anassreda45@", database="rh_ahu", charset="utf8mb4"
)
cur = conn.cursor()

# ─── Chargement données ────────────────────────────────────────────────────────
cur.execute("""
    SELECT e.matricule, e.prenom, e.nom, e.fonction,
           COALESCE(s.nom,'—') as service, e.categorie,
           COALESCE(e.qualification,'—') as qualification, e.statut
    FROM employe e
    LEFT JOIN service s ON s.id = e.service_id
    WHERE e.statut = 'actif'
    ORDER BY s.nom, e.nom, e.prenom
""")
employes = cur.fetchall()

cur.execute("SELECT id, nom FROM service ORDER BY nom")
services = cur.fetchall()

cur.execute("SELECT theme, description, duree_jours FROM cours ORDER BY theme")
cours_list = cur.fetchall()

conn.close()

# ══════════════════════════════════════════════════════════════════════════════
wb = Workbook()
wb.remove(wb.active)   # supprimer feuille vide par défaut

# ══════════════════════════════════════════════════════════════════════════════
# FEUILLE 1 — Programme Annuel
# ══════════════════════════════════════════════════════════════════════════════
ws1 = wb.create_sheet("E4 - PRO de Formation")
ws1.sheet_view.showGridLines = False
ws1.freeze_panes = "B3"

# Titre principal
ws1.merge_cells("A1:R1")
c = ws1.cell(1, 1, f"PROGRAMME DE FORMATION — AÉROPORT AL HOCEIMA (ONDA) — {YEAR}")
c.fill = fill(C_HEADER_BG)
c.font = font(bold=True, color=C_HEADER_FG, size=13)
c.alignment = align(h="center")
ws1.row_dimensions[1].height = 28

# En-têtes colonnes
COLS_PRO = ["N°", "Thème de la formation", "Participant(s)", "Organisme",
            "Durée"] + MOIS + ["Observation(s)"]
for i, label in enumerate(COLS_PRO, 1):
    bg = C_MOIS_HDR if label in MOIS else C_SUBHD_BG
    header_cell(ws1, 2, i, label, bg=bg, sz=9)

ws1.row_dimensions[2].height = 22

# Largeurs colonnes
col_widths = {1:5, 2:36, 3:22, 4:20, 5:8}
for m in range(6, 18):
    col_widths[m] = 5
col_widths[18] = 28

for col, w in col_widths.items():
    ws1.column_dimensions[get_column_letter(col)].width = w

# 30 lignes vides pré-formatées
for r in range(3, 33):
    stripe = C_STRIPE_ODD if r % 2 == 0 else C_STRIPE_EVEN
    for col in range(1, 19):
        bg = stripe
        h = "center" if col in [1, 5] + list(range(6, 18)) else "left"
        data_cell(ws1, r, col, bg=stripe, h=h)
    ws1.row_dimensions[r].height = 18

# Validation : Durée (format libre) — data validation sur mois
dv_mois = DataValidation(type="list", formula1='"x,●,x●,"', allow_blank=True)
ws1.add_data_validation(dv_mois)
for col in range(6, 18):
    dv_mois.sqref = dv_mois.sqref if hasattr(dv_mois, 'sqref') and dv_mois.sqref else ""
    for r in range(3, 200):
        dv_mois.add(ws1.cell(r, col))

# Note de légende
ws1.cell(34, 1, "Légende :").font = font(bold=True, size=9)
ws1.cell(34, 2, "x = Prévu").fill = fill(C_PREVU)
ws1.cell(34, 2).font = font(size=9)
ws1.cell(34, 3, "● = Réalisé").fill = fill(C_REALISE)
ws1.cell(34, 3).font = font(size=9)
ws1.cell(34, 4, "x● = Prévu et réalisé").font = font(size=9, italic=True)

# ══════════════════════════════════════════════════════════════════════════════
# FEUILLES ANNUELLES 2017–2025 (structure identique, vides)
# ══════════════════════════════════════════════════════════════════════════════
for year in range(2017, YEAR):
    wsY = wb.create_sheet(f"E4 - PRO de Formation {year}")
    wsY.sheet_view.showGridLines = False
    wsY.freeze_panes = "B3"

    wsY.merge_cells("A1:R1")
    c = wsY.cell(1, 1, f"PROGRAMME DE FORMATION — {year}")
    c.fill = fill(C_HEADER_BG); c.font = font(bold=True, color=C_HEADER_FG, size=13)
    c.alignment = align(h="center")
    wsY.row_dimensions[1].height = 28

    for i, label in enumerate(COLS_PRO, 1):
        bg = C_MOIS_HDR if label in MOIS else C_SUBHD_BG
        header_cell(wsY, 2, i, label, bg=bg, sz=9)
    wsY.row_dimensions[2].height = 22

    for col, w in col_widths.items():
        wsY.column_dimensions[get_column_letter(col)].width = w
    for r in range(3, 33):
        stripe = C_STRIPE_ODD if r % 2 == 0 else C_STRIPE_EVEN
        for col in range(1, 19):
            h = "center" if col in [1, 5] + list(range(6, 18)) else "left"
            data_cell(wsY, r, col, bg=stripe, h=h)
        wsY.row_dimensions[r].height = 18

# ══════════════════════════════════════════════════════════════════════════════
# FEUILLE — Suivi de Formation
# ══════════════════════════════════════════════════════════════════════════════
ws2 = wb.create_sheet("Suivi de Formation")
ws2.sheet_view.showGridLines = False
ws2.freeze_panes = "A3"

ws2.merge_cells("A1:H1")
c = ws2.cell(1, 1, "SUIVI CONSOLIDÉ DES FORMATIONS — AÉROPORT AL HOCEIMA")
c.fill = fill(C_HEADER_BG); c.font = font(bold=True, color=C_HEADER_FG, size=12)
c.alignment = align(h="center")
ws2.row_dimensions[1].height = 26

COLS_SUIVI = ["Date", "Collaborateur", "Cours / Formation", "Service",
              "Organisme", "Durée(j)", "Suivi", "Remarque"]
for i, label in enumerate(COLS_SUIVI, 1):
    header_cell(ws2, 2, i, label, sz=9)
ws2.row_dimensions[2].height = 20

suivi_widths = {1:12, 2:28, 3:36, 4:28, 5:20, 6:9, 7:9, 8:32}
for col, w in suivi_widths.items():
    ws2.column_dimensions[get_column_letter(col)].width = w

# Pré-formater 50 lignes
for r in range(3, 53):
    stripe = C_STRIPE_ODD if r % 2 == 0 else C_STRIPE_EVEN
    for col, cfg in enumerate(COLS_SUIVI, 1):
        h = "center" if col in [1, 6, 7] else "left"
        data_cell(ws2, r, col, bg=stripe, h=h)
    ws2.row_dimensions[r].height = 17

# Validation "Suivi" OUI/NON
dv_suivi = DataValidation(type="list", formula1='"OUI,NON"', allow_blank=True)
ws2.add_data_validation(dv_suivi)
for r in range(3, 1000):
    dv_suivi.add(ws2.cell(r, 7))

# ══════════════════════════════════════════════════════════════════════════════
# FEUILLE — Liste des Cours
# ══════════════════════════════════════════════════════════════════════════════
ws3 = wb.create_sheet("Liste des Cours")
ws3.sheet_view.showGridLines = False
ws3.freeze_panes = "A3"

ws3.merge_cells("A1:E1")
c = ws3.cell(1, 1, f"CATALOGUE DES COURS — {len(cours_list)} cours enregistrés")
c.fill = fill(C_HEADER_BG); c.font = font(bold=True, color=C_HEADER_FG, size=12)
c.alignment = align(h="center")
ws3.row_dimensions[1].height = 24

COLS_COURS = ["N°", "Thème", "Description", "Durée(j)", "Domaine"]
for i, label in enumerate(COLS_COURS, 1):
    header_cell(ws3, 2, i, label, sz=9)
ws3.row_dimensions[2].height = 20

cours_widths = {1:5, 2:40, 3:50, 4:9, 5:22}
for col, w in cours_widths.items():
    ws3.column_dimensions[get_column_letter(col)].width = w

if cours_list:
    for i, (theme, desc, duree) in enumerate(cours_list, 1):
        r = i + 2
        stripe = C_STRIPE_ODD if r % 2 == 0 else C_STRIPE_EVEN
        data_cell(ws3, r, 1, i, bg=stripe, h="center")
        data_cell(ws3, r, 2, theme, bg=stripe, bold=True)
        data_cell(ws3, r, 3, desc or "", bg=stripe, wrap=True)
        data_cell(ws3, r, 4, duree, bg=stripe, h="center")
        data_cell(ws3, r, 5, "", bg=stripe)
        ws3.row_dimensions[r].height = 17
else:
    # Placeholder si catalogue vide
    for r in range(3, 53):
        stripe = C_STRIPE_ODD if r % 2 == 0 else C_STRIPE_EVEN
        for col in range(1, 6):
            data_cell(ws3, r, col, bg=stripe)
        ws3.row_dimensions[r].height = 17
    ws3.cell(3, 2, "→ Importez le catalogue via RH_Formations.bas : RH_SyncFormations_Pull()").font = font(italic=True, color="999999")

# ══════════════════════════════════════════════════════════════════════════════
# FEUILLE — Collaborateurs
# ══════════════════════════════════════════════════════════════════════════════
ws4 = wb.create_sheet("Collaborateurs")
ws4.sheet_view.showGridLines = False
ws4.freeze_panes = "A3"

ws4.merge_cells("A1:H1")
c = ws4.cell(1, 1, f"LISTE DES COLLABORATEURS — {len(employes)} agents actifs")
c.fill = fill(C_HEADER_BG); c.font = font(bold=True, color=C_HEADER_FG, size=12)
c.alignment = align(h="center")
ws4.row_dimensions[1].height = 24

COLS_COLLAB = ["Matricule", "Nom", "Prénom", "Fonction", "Service", "Catégorie", "Qualification", "Statut"]
for i, label in enumerate(COLS_COLLAB, 1):
    header_cell(ws4, 2, i, label, sz=9)
ws4.row_dimensions[2].height = 20

collab_widths = {1:10, 2:20, 3:18, 4:30, 5:30, 6:18, 7:20, 8:10}
for col, w in collab_widths.items():
    ws4.column_dimensions[get_column_letter(col)].width = w

for i, (mat, prenom, nom, fonction, service, cat, qual, statut) in enumerate(employes, 1):
    r = i + 2
    stripe = C_STRIPE_ODD if r % 2 == 0 else C_STRIPE_EVEN
    data_cell(ws4, r, 1, mat, bg=stripe, h="center", bold=True)
    data_cell(ws4, r, 2, nom, bg=stripe)
    data_cell(ws4, r, 3, prenom, bg=stripe)
    data_cell(ws4, r, 4, fonction or "—", bg=stripe)
    data_cell(ws4, r, 5, service, bg=stripe)
    data_cell(ws4, r, 6, cat or "—", bg=stripe)
    data_cell(ws4, r, 7, qual or "—", bg=stripe)
    # Statut coloré
    sc = ws4.cell(r, 8, statut or "—")
    sc.fill = fill(C_ACTIF_BG if statut == "actif" else C_INACT_BG)
    sc.font = font(bold=True, color=C_ACTIF_FG if statut == "actif" else C_INACT_FG, size=9)
    sc.alignment = align(h="center")
    sc.border = thin_border()
    ws4.row_dimensions[r].height = 17

# ══════════════════════════════════════════════════════════════════════════════
# FEUILLE — RH_Config (cachée, pour VBA)
# ══════════════════════════════════════════════════════════════════════════════
ws5 = wb.create_sheet("RH_Config")
ws5.sheet_state = "veryHidden"
ws5["A1"] = "TOKEN"
ws5["B1"] = ""    # Token Bearer — rempli par RH_Login.bas
ws5["A2"] = "API_BASE"
ws5["B2"] = "http://127.0.0.1:8000/api"
ws5["A3"] = "ANNEE"
ws5["B3"] = YEAR

# ══════════════════════════════════════════════════════════════════════════════
# Ordre des feuilles + onglets couleurs
# ══════════════════════════════════════════════════════════════════════════════
tab_colors = {
    "E4 - PRO de Formation": "1A3A5C",
    "Suivi de Formation":     "2E6DA4",
    "Liste des Cours":        "27AE60",
    "Collaborateurs":         "8E44AD",
}
for name, color in tab_colors.items():
    if name in wb.sheetnames:
        wb[name].sheet_properties.tabColor = color

for year in range(2017, YEAR):
    sheet_name = f"E4 - PRO de Formation {year}"
    if sheet_name in wb.sheetnames:
        wb[sheet_name].sheet_properties.tabColor = "7F8C8D"

# ══════════════════════════════════════════════════════════════════════════════
output = r"C:/Users/VIASYS/Desktop/Rh_onda_ahu/vba/RH_Formations_ONDA.xlsx"
wb.save(output)
print(f"Fichier créé : {output}")
print(f"  - Programme Annuel {YEAR} + archives 2017-{YEAR-1}")
print(f"  - Suivi de Formation (50 lignes pré-formatées)")
print(f"  - Liste des Cours ({len(cours_list)} cours)")
print(f"  - Collaborateurs ({len(employes)} agents actifs)")
print(f"  - RH_Config (cachée, prête pour VBA)")
