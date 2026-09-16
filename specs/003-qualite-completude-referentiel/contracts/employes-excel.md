# Employees Excel Contract

Canonical columns shared by the import template, the import adapter, and the
export workbook. Headers are matched case- and accent-insensitively.

| # | Header | API field | Transport type | Validation (bulk-sync) |
|---|--------|-----------|----------------|------------------------|
| 1 | Matricule | `matricule` | Excel text | `required|string` (unique lookup key) |
| 2 | Nom | `nom` | Excel text | `required|string|max:100` |
| 3 | Prénom | `prenom` | Excel text | `required|string|max:100` |
| 4 | Sexe | `sexe` | Excel text | `nullable|in:M,F` |
| 5 | Date naissance | `date_naissance` | Excel date → `YYYY-MM-DD` | `nullable|date` |
| 6 | Date embauche | `date_embauche` | Excel date → `YYYY-MM-DD` | `nullable|date` |
| 7 | Catégorie | `categorie` | Excel text | `nullable|string|max:50` |
| 8 | Échelle | `echelle` | Excel text | `nullable|string|max:20` |
| 9 | Échelon | `echelon` | Excel text | `nullable|string|max:20` |
| 10 | Entité | `entite` | Excel text | `nullable|string|max:100` (resolved to a `Service`) |
| 11 | Fonction | `fonction` | Excel text | `nullable|string|max:100` |
| 12 | Qualification | `qualification` | Excel text | `nullable|string|max:100` |
| 13 | Service | `service` | Excel text | read-only on import (derived from `entite`) |
| 14 | Affectation | `affectation` | Excel text | `nullable|string|max:100` |
| 15 | Date affectation | `date_affectation` | Excel date → `YYYY-MM-DD` | `nullable|date` |
| 16 | Statut | `statut` | Excel text | `nullable|in:actif,mute,retraite,parti,suspendu` |
| 17 | Solde congé (j) | `solde_conge` | Excel number | `nullable|numeric|min:0` (defaults to `0`) |
| 18 | Observation | `observation` | Excel text | `nullable|string` |

The database column is `App\Models\Employe::$table = 'employe'`, whose schema is
already MySQL/SQLite compatible: `matricule` is a unique `string`,
`solde_conge` is a `float` cast to `numeric`, and the date columns are cast to
`Carbon` dates. No schema migration is introduced by this feature.

## Import

The frontend adapter (`frontend/src/components/ui/ImportExcelModal/ImportExcelModal.jsx`)
normalizes every mapped cell before posting JSON to `POST /api/employes/bulk-sync`:

```json
{
  "replace": true,
  "employes": [
    {
      "matricule": "000123",
      "nom": "DOE",
      "prenom": "Jane",
      "date_embauche": "2020-01-15",
      "solde_conge": "12"
    }
  ]
}
```

- `replace` (optional boolean, default `false`): full-sync mode. When `true`,
  every employee in the database whose `matricule` is **not** present in the
  submitted `employes` list is deleted. The UI exposes this as the
  "Remplacer la liste : supprimer les employés absents du fichier" checkbox
  (checked by default in Personnel). When omitted/false, absent employees are
  preserved.

Normalization rules:

- Text fields → trimmed string. Numeric-looking identifiers keep their exact
  characters (a `Matricule` stored as text preserves leading zeroes).
- Date fields → `YYYY-MM-DD`, accepting Excel date cells, Excel serial numbers,
  `Date` objects, and `d/m/Y` / `d-m-Y` / `d.m.Y` text.
- Numeric fields → numeric string when input is a number, otherwise the trimmed
  existing value.
- Blank optional cells are preserved as empty strings (Laravel treats them as
  `nullable`).

The response reports `created`, `modified`, `unchanged`, and `deleted` counts
(`updated` is kept as a backwards-compatible alias of `modified`). Field-level
validation errors use Laravel's `employes.{index}.{field}` keys.

Deleting an absent employee relies on the database cascade rules: `demande_conge`,
`employe_formation`, and `evaluation_formation` rows cascade, while
`pieces_jointes.uploade_par` is set to `NULL` (see migration
`2026_09_14_000001_fix_pieces_jointes_uploade_par_foreign_key.php`).

The frontend displays a confirmation only after a successful response. It states
that the database changed when `created + modified > 0`; otherwise it states that
no database change was made and reports the unchanged count.

## Export

`GET /api/employes/export` returns an `.xlsx` workbook with the canonical headers
in order. Columns 1–16 and 18 are written as explicit Excel text
(`DataType::TYPE_STRING` with number format `@`). `Solde congé (j)` (column 17)
is written as a number so `solde_conge` survives a round trip and remains
numeric. An export with no employees still contains the header row.

Exported rows can be re-imported unchanged: text identifiers keep their exact
value, `d/m/Y` date text is normalized back to `YYYY-MM-DD`, and numeric leave
balances stay numeric.
