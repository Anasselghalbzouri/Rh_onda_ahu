# Tasks: Import/export Excel compatible avec la structure MySQL

**Input**: Design documents from `specs/003-qualite-completude-referentiel/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/employes-excel.md`, `quickstart.md`

## Phase 1: Setup

- [X] T001 Review the existing Excel import/export flow and identify the mapped frontend and backend files in `frontend/src/components/ListeEmployes/ListeEmployes.jsx`, `frontend/src/components/ui/ImportExcelModal/ImportExcelModal.jsx`, `backend/app/Http/Controllers/EmployeController.php`, and `backend/app/Exports/EmployeExport.php`
- [X] T002 [P] Confirm the Excel dependencies and existing test commands in `frontend/package.json` and `backend/composer.json`
- [X] T003 [P] Verify the canonical headers and field mappings against `specs/003-qualite-completude-referentiel/contracts/employes-excel.md`

## Phase 2: Foundational

- [X] T004 [P] Verify the employee import validation rules and synchronization result fields in `backend/app/Http/Controllers/EmployeController.php`
- [X] T005 [P] Verify employee casts, identifier storage, and service resolution in `backend/app/Models/Employe.php` and `backend/app/Http/Controllers/EmployeController.php`
- [X] T006 [P] Define the shared import result shape used by frontend success and error states in `frontend/src/components/ui/ImportExcelModal/ImportExcelModal.jsx`

## Phase 3: User Story 1 - Importer un fichier Excel valide (Priority: P1) MVP

**Goal**: Importer des cellules Excel texte, nombres ou dates et synchroniser les employés sans perdre les identifiants.

**Independent Test**: Importer un classeur contenant `000123`, des champs texte, une date Excel et un solde numérique; la synchronisation réussit et les valeurs sont conservées.

- [X] T007 [P] [US1] Add backend coverage for successful bulk synchronization with text identifiers and numeric strings in `backend/tests/Feature/EmployeExcelTest.php`
- [X] T008 [P] [US1] Add backend coverage for indexed validation errors identifying the imported row and field in `backend/tests/Feature/EmployeExcelTest.php`
- [X] T009 [US1] Normalize mapped Excel text, date, numeric, and blank optional cells before posting rows in `frontend/src/components/ui/ImportExcelModal/ImportExcelModal.jsx`
- [X] T010 [US1] Preserve leading zeroes in matricules and other text identifiers when converting worksheet rows in `frontend/src/components/ui/ImportExcelModal/ImportExcelModal.jsx`
- [X] T011 [US1] Render readable Laravel validation errors with the imported row number and field name in `frontend/src/components/ui/ImportExcelModal/ImportExcelModal.jsx`
- [X] T012 [US1] Confirm normalized rows are accepted by the existing bulk-sync validation and service resolution in `backend/app/Http/Controllers/EmployeController.php`

## Phase 4: User Story 2 - Exporter un fichier réimportable (Priority: P1)

**Goal**: Produire un classeur Excel réimportable avec les mêmes colonnes, types et identifiants que l’import.

**Independent Test**: Exporter un employé `000123`, ouvrir puis réimporter le classeur; le matricule reste `000123` et la ligne est signalée comme inchangée.

- [X] T013 [P] [US2] Add backend coverage for export headers, text cell types, numeric balance cells, and leading-zero identifiers in `backend/tests/Feature/EmployeExcelTest.php`
- [X] T014 [US2] Define the canonical export headers and field order in `backend/app/Exports/EmployeExport.php`
- [X] T015 [US2] Write identifiers, labels, dates, statuses, and observations as explicit Excel text while keeping `solde_conge` numeric in `backend/app/Exports/EmployeExport.php`
- [X] T016 [US2] Ensure an empty employee export still contains the canonical headers in `backend/app/Exports/EmployeExport.php`
- [X] T017 [US2] Verify the Personnel download action calls the canonical export endpoint and uses the expected filename in `frontend/src/components/ListeEmployes/ListeEmployes.jsx`

## Phase 5: User Story 3 - Confirmer les changements après synchronisation (Priority: P1)

**Goal**: Informer l’administrateur du résultat réel de la synchronisation et préciser si la base de données a changé.

**Independent Test**: Importer un nouvel employé, modifier un employé existant, puis réimporter un fichier identique; les messages indiquent respectivement les créations, modifications et l’absence de changement.

- [X] T018 [P] [US3] Add frontend interaction coverage for created, modified, unchanged, and failed synchronization responses in `frontend/src/components/ui/ImportExcelModal/ImportExcelModal.test.jsx`
- [X] T019 [US3] Display a success confirmation only after a successful `/api/employes/bulk-sync` response in `frontend/src/components/ui/ImportExcelModal/ImportExcelModal.jsx`
- [X] T020 [US3] Include created, modified, and unchanged counts in the synchronization confirmation message in `frontend/src/components/ui/ImportExcelModal/ImportExcelModal.jsx`
- [X] T021 [US3] Explicitly state whether the database changed when all imported rows are unchanged in `frontend/src/components/ui/ImportExcelModal/ImportExcelModal.jsx`
- [X] T022 [US3] Keep API validation and synchronization errors visible without rendering a success confirmation in `frontend/src/components/ui/ImportExcelModal/ImportExcelModal.jsx`
- [X] T023 [US3] Preserve the distinction between created, modified, unchanged, and compatibility `updated` counts in `backend/app/Http/Controllers/EmployeController.php`

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T024 [P] Update the runnable import, export, round-trip, and confirmation scenarios in `specs/003-qualite-completude-referentiel/quickstart.md`
- [X] T025 [P] Verify the Excel API contract documents request fields, response counters, and validation errors in `specs/003-qualite-completude-referentiel/contracts/employes-excel.md`
- [X] T026 Run `npm run lint` and `npm run build` from `frontend/` and resolve feature-related failures in `frontend/src/components/ui/ImportExcelModal/ImportExcelModal.jsx`
- [X] T027 Run `php artisan test` and `./vendor/bin/pint` from `backend/` and resolve feature-related failures in `backend/tests/Feature/EmployeExcelTest.php`, `backend/app/Http/Controllers/EmployeController.php`, and `backend/app/Exports/EmployeExport.php`
- [X] T028 Execute the manual quickstart scenarios and record any pre-existing failures in `specs/003-qualite-completude-referentiel/quickstart.md`

## Dependencies & Execution Order

- Phase 1 precedes Phase 2.
- Phase 2 blocks all user story phases.
- US1 and US2 can proceed in parallel after Phase 2.
- US3 depends on the US1 response shape and can begin after T006; its end-to-end validation depends on US1 synchronization behavior.
- Phase 6 depends on the completed user story phases.

## Parallel Opportunities

- T002 and T003 can run in parallel.
- T004, T005, and T006 can run in parallel after setup.
- T007 and T008 can run in parallel.
- US1 and US2 can be implemented by separate contributors after Phase 2.
- T013 and T018 can run in parallel with their respective implementation work.
- T024 and T025 can run in parallel after the feature behavior is finalized.

## Implementation Strategy

1. Complete setup and foundational contract checks.
2. Deliver US1 as the MVP: normalize Excel input and synchronize employees.
3. Deliver US2: preserve typed export cells and round-trip compatibility.
4. Deliver US3: show database-change confirmation with accurate counters.
5. Run automated checks and manual quickstart validation.

## Format Validation

All implementation tasks use the required `- [ ] T### [P?] [US?] description with exact file path` format. Story phases contain the required `[US1]`, `[US2]`, or `[US3]` label; setup, foundational, and polish tasks do not.
