# Data Model

## Employe import row

The Excel row maps to `App\\Models\\Employe` and the `employes.*` request payload.

| Field | Type | Required | Validation |
|---|---|---:|---|
| matricule | string | yes | `required|string`, unique lookup key |
| nom | string | yes | `required|string|max:100` |
| prenom | string | yes | `required|string|max:100` |
| sexe | string | no | `nullable|in:M,F` |
| date_naissance | date string | no | `nullable|date` |
| date_embauche | date string | no | `nullable|date` |
| categorie, echelle, echelon | string | no | nullable string with existing max lengths |
| entite, fonction, qualification, affectation | string | no | nullable string with existing max lengths |
| date_affectation | date string | no | `nullable|date` |
| solde_conge | numeric | no | `nullable|numeric|min:0` |
| statut | enum string | no | `actif`, `mute`, `retraite`, `parti`, `suspendu` |
| observation | string | no | `nullable|string` |

## Relationships

- `Employe` may resolve `entite` to a `Service` during bulk sync.
- `Employe` is stored in the existing MySQL/SQLite-compatible Laravel schema; no migration is introduced.

## Import/export invariants

- Header labels map case- and accent-insensitively.
- Text identifiers are serialized as Excel text.
- Exported rows can be imported again without changing text identifiers.

## Synchronization result

| Field | Type | Meaning |
|---|---|---|
| total | integer | Number of submitted rows |
| created | integer | Rows inserted into the database |
| modified | integer | Existing rows whose values changed |
| updated | integer | Compatibility alias for `modified` |
| unchanged | integer | Existing rows with no changes |
| errors | integer | Import error count |
