---

description: "Task list template for feature implementation"
---

# Tasks: Refonte du Rapport d'Activité PS09 et Export des Données Employés

**Input**: Design documents from `/specs/002-rapport-activite-employes/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/rapport-employes-api.md, quickstart.md

**Tests**: Non demandés explicitement dans la spécification — aucune tâche de test dédiée générée. La validation se fait via les scénarios manuels de `quickstart.md`.

**Organization**: Les tâches sont groupées par user story (spec.md) pour permettre une implémentation et une validation indépendantes de chacune.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Peut s'exécuter en parallèle (fichiers différents, pas de dépendance bloquante)
- **[Story]**: User story concernée (US1, US2, US3)
- Chemins de fichiers exacts inclus dans chaque description

## Path Conventions

Web app à deux projets séparés (cf. plan.md) : `backend/` (Laravel API) et `frontend/` (React SPA).

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Vérifier les prérequis techniques avant toute implémentation

- [x] T001 Vérifier que `phpoffice/phpspreadsheet` (^5.7) est bien installé et à jour dans `backend/composer.json`/`backend/composer.lock` (exécuter `composer install` dans `backend/` si `vendor/` n'est pas à jour) ; aucune nouvelle dépendance à ajouter.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infrastructure bloquante partagée par toutes les user stories

**⚠️ CRITICAL**: Aucune user story ne peut démarrer avant la fin de cette phase

Cette fonctionnalité ne nécessite aucune nouvelle table, migration, ni middleware partagé : le rapport employés (US1) et la consolidation PS09 (US2/US3) sont chacun autonomes et s'appuient uniquement sur des entités et un middleware d'authentification (`auth:rh`) déjà en place. **Aucune tâche fondationnelle bloquante n'est nécessaire** — passer directement à la Phase 3.

**Checkpoint**: Fondation déjà en place — l'implémentation des user stories peut démarrer immédiatement.

---

## Phase 3: User Story 1 - Générer un export complet des données de chaque employé (Priority: P1) 🎯 MVP

**Goal**: Permettre à un RH de générer et télécharger un rapport Excel listant les informations administratives/carrière de chaque employé (filtrable par service/statut), en excluant strictement congés/maladies/absences.

**Independent Test**: Se connecter en RH, ouvrir la nouvelle page « Rapport données employés », lancer un aperçu puis un export sans filtre, et vérifier que le fichier `.xlsx` contient une ligne par employé avec les colonnes attendues et aucune colonne congé/maladie/absence (cf. `quickstart.md` Scénario 1).

### Implementation for User Story 1

- [x] T002 [P] [US1] Créer la classe `App\Exports\EmployeRapportExport` dans `backend/app/Exports/EmployeRapportExport.php` : construit un classeur PhpSpreadsheet (une feuille, ligne d'en-tête + une ligne par employé) à partir d'une requête `Employe` filtrée, en sélectionnant explicitement les colonnes listées dans `data-model.md` (matricule, nom, prénom, sexe, date_naissance, date_embauche, categorie, echelle, echelon, entite, fonction, qualification, service.nom, affectation, date_affectation, statut carrière dérivé de mutation/retraite/depart_volontaire, statut), et exposant une méthode `download()` retournant un `StreamedResponse` (suivre le pattern de `backend/app/Exports/FormationExport.php`). Ne jamais charger `solde_conge`, `demandesConge()` ni `absences()`.
- [x] T003 [US1] Créer `App\Http\Controllers\RapportEmployesController` dans `backend/app/Http/Controllers/RapportEmployesController.php` avec deux méthodes : `stats(Request $request)` qui valide les paramètres optionnels `service_id` (exists:service,id) et `statut`, applique les filtres sur `Employe::query()`, et renvoie `{"total": ..., "filtres": {...}}` en JSON ; `export(Request $request)` qui applique les mêmes filtres puis délègue à `EmployeRapportExport::download()`. Dépend de T002.
- [x] T004 [US1] Enregistrer les routes `GET /rapport-employes` → `stats` et `GET /rapport-employes/export` → `export` dans le groupe `Route::middleware('auth:rh')` existant de `backend/routes/api.php`, à côté des routes `rapport-activite`. Dépend de T003.
- [x] T005 [P] [US1] Créer le composant `frontend/src/components/RapportEmployesPage/RapportEmployesPage.jsx` : sélecteurs de filtre (service, statut), bouton « Aperçu » appelant `GET /rapport-employes` (affiche le total), bouton « Exporter » déclenchant le téléchargement blob de `GET /rapport-employes/export`, en suivant le pattern déjà utilisé dans `frontend/src/components/RapportActivitePage/RapportActivitePage.jsx` (état de chargement, gestion d'erreur, `api` axios de `frontend/src/api.js`).
- [x] T006 [P] [US1] Créer `frontend/src/components/RapportEmployesPage/RapportEmployesPage.css` en réutilisant les tokens de style existants de `frontend/src/components/RapportActivitePage/RapportActivitePage.css` (cartes, boutons, grille de filtres) pour une cohérence visuelle avec le reste de l'application.
- [x] T007 [US1] Ajouter la nouvelle page dans le routage de `frontend/src/App.jsx` (nouvelle entrée de vue/route pointant vers `RapportEmployesPage`). Dépend de T005.
- [x] T008 [US1] Ajouter l'entrée de menu « Rapport données employés » (icône + libellé) dans `frontend/src/components/Sidebar/Sidebar.jsx`, pointant vers la route ajoutée en T007. Dépend de T007.
- [x] T009 [US1] Dans `frontend/src/components/RapportEmployesPage/RapportEmployesPage.jsx`, afficher le message « Aucun employé ne correspond aux critères sélectionnés » lorsque l'aperçu renvoie `total: 0`, et désactiver le bouton « Exporter » dans ce cas (FR-005). Dépend de T005 et T004.

**Checkpoint**: User Story 1 fonctionnelle et testable indépendamment (aperçu, filtre, export, message si vide).

---

## Phase 4: User Story 2 - Mettre à jour le contenu calculé du Rapport d'Activité PS09 (Priority: P2)

**Goal**: Fiabiliser les indicateurs Formation/Effectif déjà automatisés dans le PS09, sans en ajouter de nouveaux et sans casser les graphiques natifs du classeur.

**Independent Test**: Générer un export PS09 pour un trimestre/année avec des données de formations et de mouvements d'effectif connues, et comparer les valeurs calculées à un calcul manuel/SQL de référence (cf. `quickstart.md` Scénario 4).

### Implementation for User Story 2

- [x] T010 [US2] Revoir et corriger les cas limites de calcul des indicateurs Formation (`planifiees`, `realisees`, `evaluees`, `efficaces`) dans `RapportActiviteController::computeStats()` (`backend/app/Http/Controllers/RapportActiviteController.php`), notamment la borne de fin de trimestre (`$fin`) pour le T4 à cheval sur le changement d'année, sans ajouter de nouvel indicateur.
- [x] T011 [US2] Revoir et corriger les cas limites de calcul des indicateurs Effectif (`integres`, `departs`, `mutations`) dans `RapportActiviteController::computeStats()` (`backend/app/Http/Controllers/RapportActiviteController.php`), notamment le cas d'un employé ayant plusieurs statuts de sortie (retraite + mutation) la même année. Dépend de T010 (même méthode).
- [x] T012 [US2] Valider manuellement, via le Scénario 4 de `specs/002-rapport-activite-employes/quickstart.md`, que l'export PS09 conserve intégralement les graphiques natifs et la mise en forme du classeur après la consolidation (aucune régression sur `App\Services\XlsxSurgicalPatcher`).

**Checkpoint**: User Stories 1 ET 2 fonctionnent indépendamment, sans régression sur le PS09 existant.

---

## Phase 5: User Story 3 - Exporter le rapport employés dans un format exploitable hors-ligne (Priority: P3)

**Goal**: Garantir que le fichier téléchargé du rapport employés a un nom explicite et s'ouvre correctement dans un tableur standard.

**Independent Test**: Depuis la page « Rapport données employés » (US1), déclencher un téléchargement et vérifier que le nom de fichier inclut la date de génération et que le fichier s'ouvre sans erreur dans Excel/LibreOffice (cf. `quickstart.md` Scénario 1, étape 5).

### Implementation for User Story 3

- [x] T013 [P] [US3] Dans `RapportEmployesController::export()` (`backend/app/Http/Controllers/RapportEmployesController.php`), fixer l'en-tête `Content-Disposition` au format `attachment; filename="Rapport_Employes_{YYYY-MM-DD}.xlsx"` (date de génération), conformément à `contracts/rapport-employes-api.md`.
- [x] T014 [US3] Dans `frontend/src/components/RapportEmployesPage/RapportEmployesPage.jsx`, vérifier que le nom de fichier proposé au téléchargement (blob) correspond au format défini côté backend, et confirmer visuellement que le fichier téléchargé s'ouvre correctement dans un tableur standard.

**Checkpoint**: Les trois user stories sont désormais fonctionnelles indépendamment.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finitions transverses aux trois user stories

- [x] T015 [P] Documenter les nouveaux endpoints `/rapport-employes` et `/rapport-employes/export` dans `backend/docs/API.md`, en suivant le style de documentation déjà utilisé pour `/rapport-activite`.
- [x] T016 Exécuter l'ensemble des scénarios de `specs/002-rapport-activite-employes/quickstart.md` de bout en bout (US1, US2, US3) et consigner les résultats.
- [x] T017 [P] Relire les libellés français de `RapportEmployesPage.jsx` pour la cohérence terminologique avec `RapportActivitePage.jsx` (ex. « Aperçu », « Exporter », messages d'erreur).
- [x] T018 Vérifier qu'il n'y a pas de logique dupliquée entre `RapportActiviteController` et `RapportEmployesController` (ex. validation des filtres, gestion des erreurs) et extraire un éventuel helper commun si cela simplifie sans sur-ingénierie.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Aucune dépendance — peut démarrer immédiatement
- **Foundational (Phase 2)**: Aucune tâche — les user stories peuvent démarrer dès la fin du Setup
- **User Stories (Phase 3+)**: Toutes peuvent démarrer après le Setup (Phase 1)
  - US1 (P1) est indépendante de US2/US3
  - US2 (P2) est indépendante de US1/US3 (touche uniquement le contrôleur PS09 existant)
  - US3 (P3) dépend des fichiers créés par US1 (mêmes fichiers `RapportEmployesController` et `RapportEmployesPage.jsx`), mais reste testable indépendamment une fois US1 livrée
- **Polish (Phase 6)**: Dépend de l'achèvement des user stories concernées

### User Story Dependencies

- **User Story 1 (P1)**: Peut démarrer après le Setup — aucune dépendance sur US2/US3
- **User Story 2 (P2)**: Peut démarrer après le Setup, en parallèle de US1 — fichiers distincts (`RapportActiviteController.php`), aucune dépendance
- **User Story 3 (P3)**: Doit suivre US1 (mêmes fichiers `RapportEmployesController.php` / `RapportEmployesPage.jsx`) — reste une user story indépendamment testable une fois US1 en place

### Within Each User Story

- Modèle/export avant contrôleur (T002 → T003)
- Contrôleur avant routes (T003 → T004)
- Composant frontend avant intégration routage/menu (T005 → T007 → T008)
- Implémentation avant validation manuelle (T010/T011 → T012)

### Parallel Opportunities

- T001 (Setup) peut s'exécuter seul, avant tout le reste
- US1 et US2 peuvent être développées en parallèle par deux personnes différentes (fichiers distincts)
- Au sein de US1 : T002 (export), T005 (page React) et T006 (CSS) sont parallélisables entre elles
- Au sein de la Phase 6 : T015 et T017 sont parallélisables

---

## Parallel Example: User Story 1

```bash
# Lancer en parallèle une fois le Setup terminé :
Task: "Créer la classe App\Exports\EmployeRapportExport dans backend/app/Exports/EmployeRapportExport.php"
Task: "Créer le composant frontend/src/components/RapportEmployesPage/RapportEmployesPage.jsx"
Task: "Créer frontend/src/components/RapportEmployesPage/RapportEmployesPage.css"
```

---

## Implementation Strategy

### MVP First (User Story 1 uniquement)

1. Terminer la Phase 1 : Setup (T001)
2. Phase 2 (Foundational) : aucune tâche, passer directement à la suite
3. Terminer la Phase 3 : User Story 1 (T002–T009)
4. **STOP et VALIDER** : exécuter le Scénario 1 de `quickstart.md`
5. Démo possible dès ce stade — le rapport données employés est l'essentiel de la demande initiale

### Incremental Delivery

1. Setup terminé → base prête
2. Ajouter US1 → valider indépendamment (Scénario 1, 2, 3 de `quickstart.md`) → démo (MVP)
3. Ajouter US2 → valider indépendamment (Scénario 4 de `quickstart.md`) → démo
4. Ajouter US3 → valider le nommage/téléchargement → démo
5. Polish (Phase 6) → documentation et nettoyage final

### Parallel Team Strategy

Avec deux développeurs :

1. Développeur A : Setup (T001) puis User Story 1 (T002–T009)
2. Développeur B : User Story 2 (T010–T012) en parallèle, dès la fin du Setup
3. User Story 3 (T013–T014) démarre une fois US1 livrée
4. Les deux se retrouvent pour la Phase 6 (Polish)

---

## Notes

- [P] = fichiers différents, pas de dépendance bloquante
- [Story] mappe chaque tâche à sa user story pour la traçabilité
- Aucune tâche de test dédiée n'a été générée (non demandé dans la spécification) — la validation repose sur `quickstart.md`
- Committer après chaque tâche ou groupe logique de tâches
- S'arrêter à chaque checkpoint pour valider la user story indépendamment
- Ne jamais exposer `solde_conge`, `demandesConge()` ou `absences()` dans le rapport employés (FR-002) — vérifier ce point à chaque modification de `EmployeRapportExport`
