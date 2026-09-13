# Quickstart : Validation de la fonctionnalité

## Prérequis

- Backend Laravel lancé (`cd backend && composer run dev`, ou au minimum `php artisan serve`).
- Base de données migrée avec des données de test (`php artisan migrate:fresh --seed` si un seeder d'employés existe, sinon créer manuellement quelques employés avec des statuts/services variés).
- Un utilisateur RH authentifié (cf. flux d'auth existant, guard `auth:rh`).
- Frontend lancé (`cd frontend && npm run dev`) pour valider le parcours UI.

## Scénario 1 — Export du rapport « données employés » sans filtre (User Story 1)

1. Se connecter en tant que RH.
2. Ouvrir la nouvelle page « Rapport données employés ».
3. Cliquer sur « Aperçu » (sans filtre) → vérifier que le total affiché correspond au nombre d'employés en base (`Employe::count()`).
4. Cliquer sur « Exporter ».
5. Ouvrir le fichier `.xlsx` téléchargé et vérifier :
   - une ligne d'en-tête avec les colonnes listées dans `contracts/rapport-employes-api.md` ;
   - une ligne par employé ;
   - **aucune colonne** liée aux congés, soldes de congés, maladies ou absences.

Validation via `curl` (remplacer le token/cookie de session RH) :

```bash
curl -H "Accept: application/json" "http://localhost:8000/api/rapport-employes" --cookie "<session>"
curl -o rapport-employes.xlsx "http://localhost:8000/api/rapport-employes/export" --cookie "<session>"
```

## Scénario 2 — Filtrage par service et statut (Acceptance Scenario 2)

1. Sur la page « Rapport données employés », sélectionner un service et/ou un statut (ex. `actif`).
2. Cliquer sur « Aperçu » → le total doit correspondre à `Employe::where('service_id', X)->where('statut', 'actif')->count()`.
3. Exporter → vérifier que seules les lignes correspondantes apparaissent dans le fichier.

## Scénario 3 — Aucun résultat (Edge Case / FR-005)

1. Choisir une combinaison de filtres ne correspondant à aucun employé (ex. un service sans effectif actif).
2. Cliquer sur « Aperçu » → un message explicite doit s'afficher ("Aucun employé ne correspond aux critères sélectionnés"), sans erreur technique.

## Scénario 4 — Non-régression du PS09 (User Story 2)

1. Ouvrir la page « Rapport d'activité PS09 » existante.
2. Choisir une année/trimestre pour lesquels des formations et des mouvements d'effectif existent en base.
3. Cliquer sur « Aperçu des indicateurs » → comparer les valeurs de Formation/Effectif avec un calcul manuel/SQL de référence pour confirmer l'absence de régression après la consolidation.
4. Exporter le PS09 → ouvrir le fichier et vérifier que les graphiques natifs du classeur sont toujours présents et inchangés, et que seules les cellules de données ont été mises à jour.

## Critères de sortie (liés aux Success Criteria de la spec)

- SC-001 : le scénario 1 (sans filtre, effectif actuel) se termine en moins de 30 secondes, de la demande d'export au fichier téléchargé.
- SC-002 : inspection manuelle du fichier exporté au scénario 1 confirme 0 colonne congé/maladie/absence.
- SC-003 : le scénario 4 ne montre aucune différence sur les indicateurs Formation/Effectif par rapport au comportement avant la consolidation.
