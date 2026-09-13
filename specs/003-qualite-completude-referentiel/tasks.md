---

description: "Task list template for feature implementation"
---

# Tasks: Qualité et Complétude du Référentiel

**Input**: Design documents from `/specs/003-qualite-completude-referentiel/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/completude-api.md, quickstart.md

**Tests**: Non demandés explicitement dans la spécification — aucune tâche de test automatisé générée ; la validation se fait via `quickstart.md` (Phase Polish).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Application web à deux dossiers : `backend/` (Laravel 13 API) et `frontend/` (React 19 SPA). Tous les chemins ci-dessous sont relatifs à la racine du dépôt.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Vérifier que l'environnement est prêt ; aucune nouvelle dépendance n'est nécessaire (stack déjà en place).

- [x] T001 Vérifier que `php artisan migrate:status` et `npm run build --prefix frontend -- --dry-run`-équivalent (ou `npm run lint`) passent avant toute modification, pour établir une base propre

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schéma de données, modèles et service de calcul partagés par les 3 user stories.

**⚠️ CRITICAL**: Aucune user story ne peut démarrer avant la fin de cette phase.

- [x] T002 Créer la migration `create_regle_completude_table` dans `backend/database/migrations/` avec les colonnes `champ`, `libelle`, `categorie` (nullable), `obligatoire`, `poids`, `actif`, timestamps (voir `data-model.md`)
- [x] T003 [P] Créer la migration `add_completude_fields_to_employe_table` dans `backend/database/migrations/` ajoutant `taux_completude`, `champs_manquants` (json), `date_dernier_calcul` à la table `employe`
- [x] T004 [P] Créer la migration `create_import_rapport_tables` dans `backend/database/migrations/` créant `import_rapport` et `import_rapport_ligne` (FK cascade) selon `data-model.md`
- [x] T005 [P] Créer le modèle `RegleCompletude` dans `backend/app/Models/RegleCompletude.php` (fillable, casts booléens)
- [x] T006 [P] Créer le modèle `ImportRapport` dans `backend/app/Models/ImportRapport.php` avec relation `hasMany` vers `ImportRapportLigne`
- [x] T007 [P] Créer le modèle `ImportRapportLigne` dans `backend/app/Models/ImportRapportLigne.php` avec relation `belongsTo` vers `ImportRapport`
- [x] T008 Étendre `backend/app/Models/Employe.php` : ajouter `taux_completude`, `champs_manquants`, `date_dernier_calcul` à `$fillable` et aux `$casts` (`champs_manquants` en `array`, `date_dernier_calcul` en `datetime`) — dépend de T003
- [x] T009 Créer un seeder ou une donnée de migration initiale insérant les 8 règles par défaut (`fonction`, `service_id`, `entite`, `date_embauche`, `categorie`, `echelle`, `echelon`, `date_naissance`, `categorie = null`, `obligatoire = true`, `poids = 1`) — dépend de T002
- [x] T010 Créer `backend/app/Services/CompletudeService.php` avec les méthodes `estManquant(mixed $valeur): bool` (règle R4 de `research.md` : null/vide/espaces/placeholders `-`,`--`,`N/A`), `champsManquantsPour(?string $categorie, array $donnees): array` (retourne les libellés manquants), et `recalculer(Employe $employe): void` (calcule le taux pondéré selon `research.md` R3 et persiste `taux_completude`/`champs_manquants`/`date_dernier_calcul`) — dépend de T005, T008
- [x] T011 Exécuter `php artisan migrate` et vérifier via tinker que les règles par défaut sont bien présentes (voir `quickstart.md` étape 1) — dépend de T002-T009

**Checkpoint**: Le service de calcul et le schéma sont prêts ; les user stories peuvent démarrer.

---

## Phase 3: User Story 1 - Voir et corriger les dossiers incomplets (Priority: P1) 🎯 MVP

**Goal**: Afficher, par service, la liste des agents actifs avec au moins un champ obligatoire manquant, et corriger le compteur « Dossier complet » de la fiche agent.

**Independent Test**: Créer un agent actif sans fonction ni date d'embauche, ouvrir l'écran « Dossiers incomplets », vérifier qu'il apparaît sous son service avec les libellés manquants ; corriger la fiche et vérifier sa disparition de la liste après enregistrement.

### Implementation for User Story 1

- [x] T012 [US1] Créer `backend/app/Http/Controllers/CompletudeController.php` avec la méthode `dossiersIncomplets(Request $request)` : filtre les employés `statut = 'actif'` ayant `champs_manquants` non vide, groupe par `service_id` (avec un groupe « Service non défini » pour `service_id = null`), applique les filtres optionnels `service_id`/`categorie` (contrat `GET /api/completude/dossiers-incomplets` dans `contracts/completude-api.md`)
- [x] T013 [US1] Ajouter la route `Route::get('/completude/dossiers-incomplets', [CompletudeController::class, 'dossiersIncomplets'])` dans `backend/routes/api.php`, dans le groupe de middleware d'authentification existant (à côté de `/employes`) — dépend de T012
- [x] T014 [P] [US1] Appeler `CompletudeService::recalculer($employe)` juste après la sauvegarde réussie dans `EmployeController::store` et `EmployeController::update` (`backend/app/Http/Controllers/EmployeController.php`), et inclure les nouveaux champs dans la réponse JSON de l'employé — dépend de T010
- [x] T015 [P] [US1] Créer `frontend/src/components/CompletudePage/CompletudePage.jsx` et `CompletudePage.css` avec une vue « Dossiers incomplets » groupée par service, consommant `GET /api/completude/dossiers-incomplets` via le client `api` existant (patron identique à `RapportActivitePage.jsx`)
- [x] T016 [US1] Ajouter l'entrée de menu/route vers `CompletudePage` dans `frontend/src/components/Sidebar` et dans le routeur applicatif (là où `RapportActivitePage`/`RapportEmployesPage` sont déjà enregistrées) — dépend de T015
- [x] T017 [US1] Corriger `frontend/src/components/FicheEmploye/FicheEmploye.jsx` : remplacer le calcul `dossierCompleteness` basé sur `dossierPersonnel` (ligne ~219) par une lecture directe de `employe.taux_completude`, et afficher `employe.champs_manquants` dans le résumé de la fiche — dépend de T014

**Checkpoint**: L'écran des dossiers incomplets et le compteur corrigé sont fonctionnels indépendamment.

---

## Phase 4: User Story 2 - Suivre le taux de complétude par service et par catégorie (Priority: P2)

**Goal**: Fournir une vue agrégée du taux de complétude par service et par catégorie d'agent.

**Independent Test**: Avec des agents répartis sur au moins deux services et deux catégories ayant des taux variés, ouvrir l'écran « Taux de complétude » et vérifier la cohérence des pourcentages affichés par service et par catégorie.

### Implementation for User Story 2

- [x] T018 [US2] Ajouter la méthode `taux(Request $request)` à `backend/app/Http/Controllers/CompletudeController.php` : calcule `taux_moyen`/`nb_agents_actifs`/`nb_complets` par `service_id` et par `categorie` (agents `statut = 'actif'` uniquement, cf. FR-017), avec un libellé explicite (« Aucun agent actif ») pour les groupes vides (contrat `GET /api/completude/taux`) — dépend de T010
- [x] T019 [US2] Ajouter la route `Route::get('/completude/taux', [CompletudeController::class, 'taux'])` dans `backend/routes/api.php` — dépend de T018
- [x] T020 [P] [US2] Ajouter une vue « Taux par service/catégorie » (onglet ou section) à `frontend/src/components/CompletudePage/CompletudePage.jsx`, consommant `GET /api/completude/taux`
- [x] T021 [US2] Intégrer les statistiques de fiabilité par service (issues de `GET /api/completude/taux`) dans `frontend/src/components/Dashboard/Dashboard.jsx`, à côté des autres indicateurs existants

**Checkpoint**: Les écrans de dossiers incomplets (US1) et de taux agrégés (US2) fonctionnent ensemble et indépendamment.

---

## Phase 5: User Story 3 - Empêcher l'entrée de données incomplètes via l'import Excel (Priority: P3)

**Goal**: Rejeter les lignes d'import incomplètes pour un agent actif avec un motif explicite, sans écrire de valeur de substitution, et produire un rapport d'import consultable.

**Independent Test**: Importer un fichier avec une ligne valide et une ligne d'agent actif sans fonction/service ; vérifier que seule la ligne valide crée/met à jour un employé, que la ligne invalide n'écrit rien, et que le rapport d'import liste le rejet avec son motif.

### Implementation for User Story 3

- [x] T022 [US3] Dans `backend/app/Http/Controllers/ImportController.php::syncFromExcel`, avant l'appel à `Employe::updateOrCreate`, utiliser `CompletudeService::champsManquantsPour($categorie, $data)` pour les lignes dont le `statut` calculé est `actif` ; si des champs obligatoires manquent, ne pas écrire l'enregistrement, incrémenter `skipped`, et mémoriser le numéro de ligne/matricule/motif pour le rapport — dépend de T010
- [x] T023 [US3] Appliquer la même logique de rejet dans `backend/app/Http/Controllers/ImportController.php::importFromFile` (boucle `foreach ($rows as $i => $row)`), en cohérence avec T022 — dépend de T010
- [x] T024 [US3] À la fin de `syncFromExcel` et de `importFromFile`, créer un enregistrement `ImportRapport` (origine `sync_excel`/`manuel`, totaux) puis un `ImportRapportLigne` par ligne rejetée, dans `backend/app/Http/Controllers/ImportController.php` ; inclure `import_rapport_id` dans la réponse JSON existante — dépend de T022, T023, T006, T007
- [x] T025 [P] [US3] Ajouter les méthodes `rapports(Request $request)` (liste paginée) et `rapportDetail(int $id)` (détail + lignes rejetées) à `backend/app/Http/Controllers/ImportController.php` (contrats `GET /api/import/rapports` et `GET /api/import/rapports/{id}`) — dépend de T024
- [x] T026 [US3] Ajouter les routes `Route::get('/import/rapports', ...)` et `Route::get('/import/rapports/{id}', ...)` dans `backend/routes/api.php` — dépend de T025
- [x] T027 [P] [US3] Mettre à jour `frontend/src/components/ui/ImportExcelModal/ImportExcelModal.jsx` (et `.css`) pour afficher, après un import, le nombre de lignes acceptées/rejetées et le détail des motifs via `import_rapport_id` / `GET /api/import/rapports/{id}`
- [x] T028 [US3] Créer la commande Artisan `backend/app/Console/Commands/RecalculerCompletude.php` (`app:recalculer-completude`) qui parcourt tous les employés par lot (`chunk`) et appelle `CompletudeService::recalculer()` pour chacun — dépend de T010
- [x] T029 [US3] Planifier la commande via `Schedule::command('app:recalculer-completude')->daily()` dans `backend/routes/console.php` — dépend de T028

**Checkpoint**: Toutes les user stories (US1, US2, US3) sont fonctionnelles indépendamment et ensemble.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation de bout en bout et documentation.

- [x] T030 Exécuter l'intégralité du scénario `specs/003-qualite-completude-referentiel/quickstart.md` (étapes 1 à 7) et corriger toute divergence constatée
- [x] T031 [P] Documenter les nouveaux endpoints (`/api/completude/dossiers-incomplets`, `/api/completude/taux`, `/api/import/rapports`, `/api/import/rapports/{id}`) dans `backend/docs/API.md`
- [x] T032 [P] Ajouter un état vide explicite (« Aucun agent actif ») dans `frontend/src/components/CompletudePage/CompletudePage.jsx` pour les services/catégories sans agent actif, conformément à l'edge case décrit dans `spec.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Aucune dépendance — démarre immédiatement
- **Foundational (Phase 2)**: Dépend de Setup — BLOQUE toutes les user stories
- **User Stories (Phase 3+)**: Dépendent toutes de la fin de Foundational
  - US1 (P1) peut démarrer seule
  - US2 (P2) dépend du même `CompletudeService`/`CompletudeController` que US1 mais ajoute sa propre méthode/route — peut être développée en parallèle d'US1 après T010
  - US3 (P3) dépend uniquement de `CompletudeService` (T010), pas de US1/US2 — peut être développée en parallèle
- **Polish (Phase 6)**: Dépend de l'achèvement des user stories souhaitées

### User Story Dependencies

- **US1 (P1)**: Après Phase 2 — aucune dépendance sur US2/US3
- **US2 (P2)**: Après Phase 2 — partage `CompletudeController.php` avec US1 (même fichier, tâches non parallèles entre elles si travaillées simultanément) mais reste testable indépendamment via son propre endpoint
- **US3 (P3)**: Après Phase 2 — aucune dépendance sur US1/US2 (fichiers distincts : `ImportController.php`, `RecalculerCompletude.php`)

### Parallel Opportunities

- T003, T004, T005, T006, T007 (Phase 2, fichiers distincts) en parallèle après T002 le cas échéant
- T014 et T015 (Phase 3, fichiers distincts backend/frontend) en parallèle
- T020 (Phase 4, frontend) en parallèle avec T018/T019 (backend) une fois T010 posé
- T025 et T027 (Phase 5) en parallèle
- US1, US2 et US3 peuvent être développées par des personnes différentes en parallèle une fois la Phase 2 terminée (fichiers largement disjoints, à l'exception de `CompletudeController.php` partagé entre US1/US2)

---

## Parallel Example: Phase 2 (Foundational)

```bash
Task: "Créer le modèle RegleCompletude dans backend/app/Models/RegleCompletude.php"
Task: "Créer le modèle ImportRapport dans backend/app/Models/ImportRapport.php"
Task: "Créer le modèle ImportRapportLigne dans backend/app/Models/ImportRapportLigne.php"
```

## Parallel Example: User Story 1

```bash
Task: "Appeler CompletudeService::recalculer dans EmployeController::store/update"
Task: "Créer frontend/src/components/CompletudePage/CompletudePage.jsx (vue Dossiers incomplets)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Compléter Phase 1 (Setup)
2. Compléter Phase 2 (Foundational — CRITIQUE)
3. Compléter Phase 3 (US1 : dossiers incomplets + correction du compteur « Dossier complet »)
4. **STOP et VALIDER** : reproduire le bug initial (agent complet affichant 0 %) et confirmer qu'il est corrigé
5. Démo/déploiement si prêt

### Incremental Delivery

1. Setup + Foundational → base prête
2. US1 → testable indépendamment → démo (MVP : le symptôme signalé par l'utilisateur est résolu)
3. US2 → testable indépendamment → démo (pilotage par service/catégorie)
4. US3 → testable indépendamment → démo (garde-fou à l'import + rapport)
5. Chaque story ajoute de la valeur sans casser les précédentes

### Parallel Team Strategy

1. L'équipe complète Setup + Foundational ensemble
2. Une fois Foundational terminé :
   - Développeur A : US1
   - Développeur B : US2 (attend que T010/T012 existent avant de toucher `CompletudeController.php`)
   - Développeur C : US3 (fichiers `ImportController.php`/`RecalculerCompletude.php`, indépendants)
3. Les stories s'intègrent indépendamment

---

## Notes

- Aucune tâche de test automatisé n'a été générée : ni `spec.md` ni la demande utilisateur n'exigent explicitement une approche TDD. La validation repose sur `quickstart.md` (T030).
- `CompletudeController.php` est partagé entre US1 (T012/T013) et US2 (T018/T019) : éviter de travailler les deux méthodes simultanément sur la même branche sans coordination pour limiter les conflits de merge.
- Commiter après chaque tâche ou groupe logique ; s'arrêter à chaque checkpoint pour valider la story indépendamment avant de poursuivre.
