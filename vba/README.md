# VBA — Modules de synchronisation RH-ONDA

## ⚡ Synchronisation automatique (watcher Python)

Pour une synchro **automatique** (sans lancer de macro ni de script à la main),
utilisez le watcher `watch_rh_onda.py`. Dès que vous **enregistrez** un des fichiers
Excel surveillés, les données sont poussées vers l'API :

| Fichier surveillé | Envoyé vers |
|---|---|
| `modele_import_employes.xlsx` (feuille EMPLOYES) | `/api/employes/bulk-sync` |
| `Tableau de Suivi de Formation siège.xlsx` (feuille `Liste des Cours`) | `/api/cours/bulk-sync` |
| `Tableau de Suivi de Formation siège.xlsx` (feuille `Suivi de Formation`) | `/api/suivi-formation/bulk-sync` |

En parallèle, un **instantané** des employés est régénéré dans un fichier *séparé*
`modele_import_employes_export.xlsx` à intervalle régulier.

Chaque fichier peut être activé/désactivé dans `watch_config.ini`
(`watch_employes`, `watch_formation`).

### Décisions d'architecture

| Sujet | Choix |
|---|---|
| Déclencheur | À l'enregistrement du fichier (surveillance temps réel) |
| Sens Excel → plateforme | Temps réel, sur enregistrement, **un seul sens** |
| Sens plateforme → Excel | Fichier **export séparé** (jamais le fichier source), régénéré sur intervalle |
| Conflit (modifié des deux côtés) | **Excel fait foi** — la valeur du `.xlsx` gagne ; l'export est en lecture seule |
| Statut de synchro | Écrit dans le journal `watch.log` (jamais dans le classeur, qui est verrouillé quand il est ouvert) |
| Lecture des fichiers | En **lecture seule** (`data_only`), le classeur est fermé aussitôt : aucun risque pour les graphiques/macros |
| Rapport PS09 | **Non surveillé** — trop de graphiques natifs, reste géré par VBA |

### Installation

```bash
cd vba
pip install -r requirements.txt          # openpyxl, requests, watchdog
cp watch_config.example.ini watch_config.ini
# éditer watch_config.ini : matricule, mot de passe, api_url
```

### Utilisation

```bash
python watch_rh_onda.py
```

Laissez la fenêtre ouverte : à chaque `Ctrl+S` dans Excel, la synchro part
automatiquement (avec un anti-rebond de ~2,5 s et un contrôle de hash pour éviter
les envois inutiles). `Ctrl+C` pour arrêter.

- Le fichier source n'est **jamais** modifié par le watcher (il est ouvert dans
  Excel = verrou en écriture). Le statut va dans `watch.log`.
- L'instantané `modele_import_employes_export.xlsx` sert de **vue de contrôle** de
  la base ; comme « Excel fait foi », il n'est pas ré-importé automatiquement.
- `watch_config.ini`, `watch.log` et l'export sont ignorés par git.

### Fichier de formation — rapprochement par nom

Le suivi de formation est bien synchronisé automatiquement (sens Excel → plateforme),
mais ce fichier identifie les collaborateurs par **nom en texte libre** (pas de
colonne matricule/ID). Le serveur tente de les rapprocher d'une fiche employé ;
ceux qui ne correspondent pas sont comptés comme **« introuvables »** et signalés
dans `watch.log` (au lieu des cellules colorées de la version VBA). Corrigez
l'orthographe du nom dans Excel puis ré-enregistrez — la formation déjà créée est
simplement mise à jour, pas dupliquée.

> Le **retour dans les cellules** (statut coloré 🟩/🟧 ligne par ligne) reste
> l'apanage des macros VBA (`RH_SyncSuiviFormation`), car le watcher n'écrit jamais
> dans le fichier surveillé. Si ce retour visuel vous est indispensable, gardez le
> bouton VBA pour ce fichier plutôt que le watcher (mais pas les deux en même temps).

### Scripts manuels (inchangés)

- `sync_rh_onda.py` — synchro **manuelle** Excel → API (employés, cours, suivi).
- `export_rh_onda.py` — génère l'instantané plateforme → Excel une seule fois
  (`python export_rh_onda.py --matricule … --password …`).

## Fichiers

| Fichier | Tâche | Rôle |
|---|---|---|
| `RH_Login.bas` | T-062 | Connexion API, stockage Bearer token |
| `RH_Sync.bas` | T-063/064 | Lecture feuille EMPLOYES, envoi bulk-sync, écriture colonne R |
| `RH_Cours.bas` | — | Synchronise `Liste des Cours` → `POST /api/cours/bulk-sync` (classeur `Tableau de Suivi de Formation siège.xlsx`) |
| `RH_SuiviFormation.bas` | — | Synchronise `Suivi de Formation` → `POST /api/suivi-formation/bulk-sync` (même classeur) — crée le cours et la formation si besoin, retrouve le collaborateur par nom et l'inscrit |
| `RH_RapportActivite.bas` | — | Remplit les indicateurs calculables du rapport PS09 (`PS09_Rapport d'activité Trimestriel.xlsx`) depuis `GET /api/rapport-activite` |

> `RH_Formations.bas` cible un autre classeur (`RH_Formations_ONDA.xlsx`, généré par
> `build_formations_excel.py`, en-têtes en ligne 1/3). Pour le vrai fichier RH
> `Tableau de Suivi de Formation siège.xlsx` (en-têtes en ligne 6/14), utiliser
> `RH_Cours.bas` et `RH_SuiviFormation.bas` ci-dessous — voir la section dédiée
> plus bas dans ce document.

## Installation dans le classeur Excel

1. Ouvrir le classeur `.xlsm` (ou `.xlsb`) dans Excel
2. **Alt + F11** → Éditeur VBA
3. Dans l'explorateur de projet : clic droit sur le nom du classeur → **Importer un fichier**
4. Importer `RH_Login.bas` puis `RH_Sync.bas`
5. Fermer l'éditeur VBA

## Utilisation

### Connexion
```vba
' Depuis VBA ou un bouton Excel :
Call RH_Login      ' demande matricule + mot de passe, stocke le token
' ou automatiquement au premier appel de sync
```

### Synchronisation
```vba
Call RH_SyncEmployes   ' lit EMPLOYES!A2:Q*, envoie l'API, écrit colonne R
```

### Déconnexion locale
```vba
Call RH_ClearToken     ' efface le token de la feuille cachée
```

## Structure attendue de la feuille "EMPLOYES"

| Col | Champ |
|-----|-------|
| A | MATRICULE |
| B | NOM |
| C | PRENOM |
| D | SEXE (M/F) |
| E | DATE_NAISSANCE (dd/mm/yyyy) |
| F | DATE_EMBAUCHE |
| G | CATEGORIE |
| H | ECHELLE |
| I | ECHELON |
| J | ENTITE |
| K | FONCTION |
| L | QUALIFICATION |
| M | AFFECTATION |
| N | DATE_AFFECTATION |
| O | SOLDE_CONGE |
| P | STATUT |
| Q | OBSERVATION |
| **R** | **STATUT_SYNC** ← rempli automatiquement |

## Configuration

Modifier `API_URL` dans les deux modules si l'URL du serveur change :
```vba
Private Const API_URL As String = "http://localhost:8000/api"
```

## Sécurité

- Le token est stocké dans une feuille **très cachée** (`xlSheetVeryHidden`) nommée `RH_Config`
- Il n'est pas lisible depuis l'interface Excel (uniquement via VBA)
- En cas d'expiration (HTTP 401), le module efface automatiquement le token et invite à se reconnecter

---

## Suivi de formation (`Tableau de Suivi de Formation siège.xlsx`)

Ce classeur est le fichier RH historique réel (données depuis 2017), avec une
mise en page différente du fichier généré `RH_Formations_ONDA.xlsx` :
en-têtes en ligne 6 (`Liste des Cours`) et ligne 14 (`Suivi de Formation`), pas
en ligne 1/3. Il n'a pas de colonne matricule — les collaborateurs y sont
identifiés par nom en texte libre.

### Installation

1. Ouvrir `Tableau de Suivi de Formation siège.xlsx`, l'enregistrer en `.xlsm`.
2. `Alt+F11` → importer `RH_Login.bas` (si pas déjà présent dans ce classeur),
   puis `RH_Cours.bas` et `RH_SuiviFormation.bas`.
3. Aucune feuille `RH_Config` à créer manuellement : `RH_Login.bas` la crée
   automatiquement (très cachée) au premier lancement.

### Utilisation

1. `Alt+F8` → `RH_SyncCours` — synchronise `Liste des Cours` (colonnes C=Thème,
   D=Description, E=Durée) vers `POST /api/cours/bulk-sync`. Écrit le statut en
   colonne F.
2. `Alt+F8` → `RH_SyncSuiviFormation` — synchronise `Suivi de Formation`
   (C=Date, D=Collaborateur, E=Cours, F=Service, G=Suivi OUI/NON, H=Remarque)
   vers `POST /api/suivi-formation/bulk-sync`. Écrit le statut en colonne I :
   - 🟩 `OK Synchro` — cours/formation créés ou mis à jour, collaborateur inscrit
   - 🟧 `Employe non trouve` — formation créée mais aucun employé ne correspond
     au nom (orthographe à corriger dans le fichier, ou le collaborateur n'a pas
     de fiche employé sur la plateforme)
   - 🟥 `Erreur` — données rejetées par le serveur
3. On peut assigner chaque macro à un bouton sur la feuille correspondante
   (`Développeur > Insérer > Bouton` > `Affecter une macro`).

### Rapprochement collaborateur ↔ employé

La colonne `Collaborateurs` (`D`) contient un nom en texte libre (ex.
`EL GHALBZOURI Abdelhak`). Le serveur essaie de le faire correspondre à un
employé existant (`nom prenom` ou `prenom nom`, insensible aux accents/casse).
En cas d'échec (homonyme, variante d'orthographe), corriger le nom dans Excel
pour qu'il corresponde exactement à la fiche employé, puis relancer
`RH_SyncSuiviFormation` — la formation déjà créée est simplement mise à jour,
pas dupliquée.

---

## Rapport d'activité PS09 (`PS09_Rapport d'activité  Tremistriel _ 2025.xlsx`)

Ce classeur contient une feuille par trimestre, chacune avec 11 graphiques
Excel natifs qui lisent des plages de cellules fixes (ex. `$H$217:$H$222`).
**On ne reconstruit jamais les graphiques** — `RH_RapportActivite.bas`
remplit uniquement les cellules de données sources ; les graphiques et les
colonnes de taux (déjà des formules `=G/F` etc.) se recalculent seuls.

### Périmètre — ce qui est auto-rempli vs manuel

| Indicateur | Source |
|---|---|
| Nbre de Formations Planifiées / Réalisées | ✅ Table `formation` (dates de la période) |
| Nbre des Formations Évaluées / Nb de formations efficaces | ✅ `evaluation_formation` (champ `efficace`) |
| Nbre d'effectif intégré (année) | ✅ `employe.date_embauche` |
| Nbre de départs (année) | ✅ `employe.retraite`/`depart_volontaire` + dates |
| Nbre de mutation (année) | ✅ `employe.mutation` + `date_mutation` |
| Accidents du travail, Taux de polyvalence, Actions d'amélioration, Réclamations du personnel, Besoins de recrutement exprimés, Stagiaires, Commentaires | ❌ Pas de table dédiée dans la plateforme — **reste en saisie manuelle**, comme aujourd'hui |

### Installation

1. Ouvrir `PS09_Rapport d'activité  Tremistriel _ 2025.xlsx`, l'enregistrer en `.xlsm`
2. `Alt+F11` → importer `RH_Login.bas` (si absent de ce classeur) puis `RH_RapportActivite.bas`
3. Ajouter un bouton sur chaque feuille trimestrielle → macro **`RH_GenerateRapport`**

### Utilisation

1. Se placer sur la feuille du trimestre à mettre à jour (l'onglet correspondant, ex. `E3 Rap Act Oct 2025`)
2. Lancer `RH_GenerateRapport` — la macro lit la date en ligne 5 de la feuille pour déterminer année/trimestre, demande confirmation, puis remplit les cellules ci-dessus
3. Compléter manuellement les indicateurs non calculables (colonnes déjà existantes dans le fichier, comportement inchangé)

### Comment la macro trouve les bonnes cellules

Elle **cherche les en-têtes par leur texte** (`Cells.Find`) plutôt que des
coordonnées fixes, car chaque feuille trimestrielle a un décalage de lignes
différent (commentaires de longueur variable). Si un en-tête a été renommé
ou n'est pas trouvé, cet indicateur est simplement ignoré (pas d'erreur
bloquante) — le message final indique ce qui a été rempli.
