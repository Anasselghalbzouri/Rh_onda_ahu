# Contrat API : Rapport Données Employés

Toutes les routes sont sous le groupe `Route::middleware('auth:rh')` existant (`backend/routes/api.php`), préfixe `/api`. Suit le style déjà utilisé par `RapportActiviteController` (validation via `$request->validate()`, réponses JSON pour la prévisualisation, `BinaryFileResponse`/stream pour l'export).

## `GET /api/rapport-employes`

Prévisualisation JSON du rapport (nombre d'employés correspondant aux filtres + aperçu), utilisée par le frontend avant export (cf. User Story 1, Acceptance Scenario 3).

**Query params**

| Nom | Type | Requis | Contrainte |
|---|---|---|---|
| `service_id` | integer | Non | Doit exister dans la table `service` |
| `statut` | string | Non | Une des valeurs déjà utilisées par `employes.statut` (`actif`, `mute`, `retraite`, `parti`, `suspendu`) |

**Réponse 200**

```json
{
  "total": 42,
  "filtres": { "service_id": null, "statut": "actif" }
}
```

**Réponse 200 (aucun résultat)** — `total: 0`, le frontend affiche alors le message "Aucun employé ne correspond aux critères sélectionnés" (FR-005).

## `GET /api/rapport-employes/export`

Génère et télécharge le fichier Excel (mêmes filtres que ci-dessus).

**Query params** : identiques à `GET /api/rapport-employes`.

**Réponse 200** : flux binaire `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, en-tête `Content-Disposition: attachment; filename="Rapport_Employes_{YYYY-MM-DD}.xlsx"` (FR-004).

**Colonnes du classeur** (une feuille, ligne d'en-tête + une ligne par employé) — voir `data-model.md` pour le détail des champs :

`Matricule | Nom | Prénom | Sexe | Date de naissance | Date d'embauche | Catégorie | Échelle | Échelon | Entité | Fonction | Qualification | Service | Affectation | Date d'affectation | Statut carrière | Statut`

**Garantie explicite** : aucune colonne relative aux congés, soldes de congés, maladies ou absences n'apparaît dans ce classeur (FR-002).

**Erreurs**

| Cas | Réponse |
|---|---|
| Non authentifié / non RH | 401/403 (comportement standard du middleware `auth:rh`) |
| `service_id` invalide | 422 (erreurs de validation Laravel) |
| Aucun employé trouvé pour les filtres | 200 avec un classeur ne contenant que la ligne d'en-tête (l'appel `GET /api/rapport-employes` en amont permet au frontend d'avertir l'utilisateur avant l'export, cf. FR-005) |

## Routes existantes non modifiées (PS09)

- `GET /api/rapport-activite` (stats)
- `GET /api/rapport-activite/sheets`
- `GET /api/rapport-activite/export`

Ces routes conservent leur contrat actuel ; seule l'implémentation interne de `RapportActiviteController::computeStats()` est consolidée (cf. `research.md` §4), sans changement de signature ni de format de réponse.
