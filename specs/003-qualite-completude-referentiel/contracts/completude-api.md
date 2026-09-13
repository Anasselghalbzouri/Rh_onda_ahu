# API Contract: Complétude du Référentiel

Toutes les routes sont sous `routes/api.php`, protégées par le même middleware d'authentification que les routes `employes`/`rapport-activite` existantes.

## GET /api/completude/dossiers-incomplets

Liste des employés (actifs par défaut) avec au moins un champ obligatoire manquant, groupés par service.

**Query params**: `service_id` (optionnel, filtre), `categorie` (optionnel, filtre)

**Response 200**:
```json
{
  "services": [
    {
      "service_id": 3,
      "service_nom": "Navigation Aérienne",
      "employes": [
        {
          "id": 42,
          "matricule": "E00123",
          "nom_complet": "Karim Alaoui",
          "categorie": "Cadre",
          "taux_completude": 62,
          "champs_manquants": ["Fonction manquante", "Date d'embauche manquante"],
          "date_dernier_calcul": "2026-09-13T02:00:00Z"
        }
      ]
    },
    {
      "service_id": null,
      "service_nom": "Service non défini",
      "employes": []
    }
  ]
}
```

## GET /api/completude/taux

Taux de complétude agrégé par service et par catégorie d'agent (agents actifs uniquement, cf. FR-017).

**Response 200**:
```json
{
  "par_service": [
    { "service_id": 3, "service_nom": "Navigation Aérienne", "nb_agents_actifs": 10, "taux_moyen": 84, "nb_complets": 6 },
    { "service_id": null, "service_nom": "Aucun agent actif", "nb_agents_actifs": 0, "taux_moyen": null, "nb_complets": 0 }
  ],
  "par_categorie": [
    { "categorie": "Cadre", "nb_agents_actifs": 15, "taux_moyen": 78, "nb_complets": 9 },
    { "categorie": "Exécution", "nb_agents_actifs": 40, "taux_moyen": 91, "nb_complets": 36 }
  ]
}
```

## GET /api/import/rapports

Liste paginée des exécutions d'import Excel (historique).

**Query params**: `page`, `origine` (optionnel : `manuel` | `sync_excel`)

**Response 200**:
```json
{
  "data": [
    {
      "id": 17,
      "origine": "manuel",
      "nom_fichier": "effectif_2026_09.xlsx",
      "total_lignes": 120,
      "lignes_acceptees": 115,
      "lignes_rejetees": 5,
      "created_at": "2026-09-12T10:00:00Z"
    }
  ],
  "meta": { "current_page": 1, "last_page": 3 }
}
```

## GET /api/import/rapports/{id}

Détail d'une exécution d'import, incluant les lignes rejetées et leur motif.

**Response 200**:
```json
{
  "id": 17,
  "origine": "manuel",
  "nom_fichier": "effectif_2026_09.xlsx",
  "total_lignes": 120,
  "lignes_acceptees": 115,
  "lignes_rejetees": 5,
  "created_at": "2026-09-12T10:00:00Z",
  "lignes_rejetees_detail": [
    { "numero_ligne": 14, "matricule": "E00456", "motif": "Fonction manquante, Service manquant" }
  ]
}
```

**Response 404**: import inexistant.

## Endpoints existants étendus (comportement, pas de nouvelle route)

### POST /api/employes/bulk-sync (`ImportController::syncFromExcel`)
### POST /api/employes/import (`ImportController::importFromFile`, route existante non listée ci-dessus)

**Changement de comportement** :
- Avant tout `Employe::updateOrCreate`, chaque ligne concernant un agent dont le `statut` calculé est `actif` est validée contre les règles obligatoires de `regle_completude` applicables à sa catégorie.
- Si un ou plusieurs champs obligatoires sont manquants : la ligne n'est **pas** écrite en base (ni création, ni mise à jour), elle est comptée dans `skipped`/`lignes_rejetees`, et un enregistrement `ImportRapportLigne` est créé avec le motif (liste des libellés manquants séparés par virgule).
- Un enregistrement `ImportRapport` est créé à la fin de l'exécution, résumant `total_lignes`/`lignes_acceptees`/`lignes_rejetees`.
- La réponse JSON existante (`success`, `inserted`, `updated`, `skipped`, `errors`, `total_db` pour `syncFromExcel` ; `success`, `total`, `created`, `updated`, `errors` pour `importFromFile`) est conservée telle quelle pour compatibilité, avec un champ additionnel `import_rapport_id` permettant au frontend de charger le détail via `GET /api/import/rapports/{id}`.

### POST /api/employes et PUT /api/employes/{id} (`EmployeController::store`/`update`)

**Changement de comportement** : après la sauvegarde réussie de la fiche, `CompletudeService::recalculer($employe)` est appelé et les nouvelles valeurs (`taux_completude`, `champs_manquants`, `date_dernier_calcul`) sont incluses dans la réponse JSON existante de l'employé (pas de nouveau champ de requête, uniquement des champs de réponse supplémentaires déjà couverts par `data-model.md`).
