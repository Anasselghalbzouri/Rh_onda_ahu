# Data Model: Qualité et Complétude du Référentiel

## RegleCompletude (nouvelle table `regle_completude`)

Représente une règle de complétude appliquée à un champ de la fiche employé pour une (ou toutes les) catégorie(s) d'agent.

| Champ | Type | Contraintes | Description |
|---|---|---|---|
| `id` | bigint PK | auto-increment | |
| `champ` | string(100) | requis | Nom du champ ciblé sur `employe` (ex. `fonction`, `service_id`, `entite`, `date_embauche`, `categorie`, `echelle`, `echelon`, `date_naissance`) |
| `libelle` | string(150) | requis | Libellé en clair affiché dans les écrans (ex. « Fonction manquante ») |
| `categorie` | string(100) | nullable | Catégorie d'agent concernée (valeur du champ `employe.categorie`) ; `NULL` = s'applique à toutes les catégories |
| `obligatoire` | boolean | requis, défaut `true` | Si `false`, le champ contribue au taux mais ne bloque pas l'import |
| `poids` | unsignedSmallInteger | requis, défaut `1` | Poids du champ dans le calcul pondéré du taux |
| `actif` | boolean | requis, défaut `true` | Permet de désactiver une règle sans la supprimer |
| `created_at` / `updated_at` | timestamp | | |

**Validation**: `champ` doit correspondre à une colonne existante et autorisée de `employe` (liste blanche côté application, pas de contrainte FK possible sur un nom de colonne). Unicité logique sur (`champ`, `categorie`) pour éviter les règles dupliquées — appliquée en validation applicative, pas en contrainte SQL (SQLite + `categorie` nullable rend l'unicité SQL fragile).

**Seed initial** (aligné sur FR-002, `categorie = NULL` = toutes catégories, `obligatoire = true`, `poids = 1`) :
`fonction`, `service_id`, `entite`, `date_embauche`, `categorie`, `echelle`, `echelon`, `date_naissance`.

## Employe (table existante `employe`, étendue)

Nouvelles colonnes ajoutées par migration :

| Champ | Type | Contraintes | Description |
|---|---|---|---|
| `taux_completude` | unsignedTinyInteger | nullable, défaut `null` | Taux de complétude calculé (0–100), `null` = jamais calculé |
| `champs_manquants` | json | nullable | Liste des libellés de champs manquants (ex. `["Fonction manquante", "Date d'embauche manquante"]`) |
| `date_dernier_calcul` | timestamp | nullable | Date/heure du dernier calcul de complétude |

**Règles de calcul** (implémentées dans `CompletudeService`, pas en base) :
- Ne s'applique strictement (FR-002) qu'aux employés dont `statut === 'actif'`.
- Pour un employé non actif, le taux est tout de même calculé (pour cohérence d'affichage, cf. edge cases) mais n'entre pas dans les statistiques de « fiabilité de l'effectif actif » (FR-017).
- Un champ est "manquant" selon la normalisation R4 de `research.md` (null, vide, espaces, placeholders `-`/`--`/`N/A`).
- Relation logique avec `RegleCompletude` : pour chaque employé, règles applicables = règles `actif=true` où `categorie IS NULL OR categorie = employe.categorie`.

**Pas de nouvelle relation Eloquent structurelle** : `champs_manquants` reste un tableau dénormalisé (JSON) plutôt qu'une table pivot, car il ne s'agit que d'un résultat de calcul dérivé, recalculé entièrement à chaque exécution (pas de nécessité de requêtabilité relationnelle fine à ce stade).

## ImportRapport (nouvelle table `import_rapport`)

Une ligne par exécution d'import Excel (manuel ou synchronisation automatique).

| Champ | Type | Contraintes | Description |
|---|---|---|---|
| `id` | bigint PK | auto-increment | |
| `origine` | string(30) | requis | `manuel` (upload via `importFromFile`) ou `sync_excel` (via `syncFromExcel`) |
| `nom_fichier` | string(255) | nullable | Nom original du fichier importé, si connu |
| `total_lignes` | unsignedInteger | requis | Nombre total de lignes traitées |
| `lignes_acceptees` | unsignedInteger | requis | Nombre de lignes créées ou mises à jour |
| `lignes_rejetees` | unsignedInteger | requis | Nombre de lignes rejetées pour incomplétude ou autre erreur |
| `execute_par` | bigint nullable (FK logique vers `users.id`) | nullable | Utilisateur ayant déclenché l'import, si authentifié |
| `created_at` | timestamp | | Date d'exécution de l'import |

## ImportRapportLigne (nouvelle table `import_rapport_ligne`)

Une ligne par ligne rejetée d'un import (détail du motif).

| Champ | Type | Contraintes | Description |
|---|---|---|---|
| `id` | bigint PK | auto-increment | |
| `import_rapport_id` | bigint FK → `import_rapport.id` | requis, `onDelete('cascade')` | Import parent |
| `numero_ligne` | unsignedInteger | requis | Numéro de la ligne dans le fichier source (base 1, en-tête exclu) |
| `matricule` | string(50) | nullable | Matricule de la ligne, si lisible |
| `motif` | string(500) | requis | Motif du rejet en clair (ex. « Fonction manquante, Service manquant ») |
| `created_at` | timestamp | | |

**Relations**: `ImportRapport hasMany ImportRapportLigne` ; pas de relation directe vers `Employe` (une ligne rejetée n'a, par définition, jamais créé/modifié d'enregistrement `Employe`).

## Résumé des relations

```text
RegleCompletude  ──(règles applicables selon categorie)──>  Employe
Employe          ──(taux_completude, champs_manquants)──>   FicheEmploye (frontend), CompletudePage (frontend), Dashboard (frontend)
ImportRapport    ──hasMany──>  ImportRapportLigne
```
