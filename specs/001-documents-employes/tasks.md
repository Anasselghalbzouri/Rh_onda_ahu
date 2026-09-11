---

description: "Task list for Documents employés (remplace Absences)"
---

# Tasks: Documents employés (remplace Absences)

**Input**: Design documents from `/specs/001-documents-employes/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/documents-employes-api.md, quickstart.md

**Tests**: Non explicitement demandés dans la spécification — aucune tâche de test dédiée n'est générée ; la validation se fait via `quickstart.md` (Polish) et les suites existantes (`php artisan test`, `npm run lint`).

**Organization**: Tâches groupées par user story (spec.md) pour permettre une implémentation et une livraison indépendantes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Peut s'exécuter en parallèle (fichiers différents, pas de dépendance)
- **[Story]**: User story concernée (US1, US2, US3)

## Path Conventions

Web app à deux projets (voir plan.md → Structure Decision) : `backend/` (Laravel) et `frontend/` (React).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Constantes partagées de référence (catégories, statuts) utilisées par le backend et le frontend.

- [X] T001 [P] Créer la liste de référence des catégories et statuts de documents côté backend dans `backend/app/Support/DocumentsEmployesReference.php` (constantes `CATEGORIES` et `STATUTS`, valeurs issues de data-model.md)
- [X] T002 [P] Créer la liste de référence équivalente côté frontend dans `frontend/src/constants/documentsEmployes.js` (catégories, statuts avec libellés/couleurs pour `ui/Badge`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Étend l'entité `PieceJointe` et sécurise le téléchargement — requis par les 3 user stories.

**⚠️ CRITICAL**: Aucune tâche de user story ne doit démarrer avant la fin de cette phase.

- [X] T003 Créer la migration `backend/database/migrations/2026_09_11_000000_add_statut_expiration_obligatoire_to_pieces_jointes.php` ajoutant `date_expiration` (date, nullable), `statut` (string, nullable), `obligatoire` (boolean, défaut false), `supprime_par` (integer FK nullable) à la table `pieces_jointes`, de façon réversible (voir data-model.md)
- [X] T004 Mettre à jour `backend/app/Models/PieceJointe.php` : ajouter les nouveaux champs à `$fillable`, les casts (`date_expiration` → date, `obligatoire` → boolean), une relation `supprimePar()` (`belongsTo(ResponsableRh::class, 'supprime_par')`) et une méthode `statutCalcule()` implémentant la règle de dérivation (valide/à renouveler/expiré) de data-model.md
- [X] T005 Mettre à jour `PieceJointeController::format()` dans `backend/app/Http/Controllers/PieceJointeController.php` pour inclure `date_expiration`, `statut` (calculé via `statutCalcule()`) et `obligatoire` dans toutes les réponses
- [X] T006 Mettre à jour `PieceJointeController::destroy()` dans `backend/app/Http/Controllers/PieceJointeController.php` pour enregistrer `supprime_par` = utilisateur RH courant lors de la suppression logique
- [X] T007 Ajouter la route protégée `GET /pieces-jointes/{id}/download` dans `backend/routes/api.php` et implémenter `PieceJointeController::download()` : retourne le fichier en flux (`response()->download()` ou équivalent) au lieu d'une URL publique, `404` si document introuvable/inactif
- [X] T008 Retirer l'exposition d'URL publique côté frontend : dans `frontend/src/components/FicheEmploye/FicheEmploye.jsx`, remplacer les liens directs vers `p.url` par des appels à la nouvelle route de téléchargement protégée (ex. `api.get('/pieces-jointes/{id}/download', { responseType: 'blob' })`)

**Checkpoint**: Le socle documentaire (`PieceJointe` étendu + téléchargement sécurisé) est prêt ; les user stories peuvent démarrer.

---

## Phase 3: User Story 1 - RH consulte et gère les documents de tous les employés (Priority: P1) 🎯 MVP

**Goal**: Un utilisateur RH dispose d'une section "Documents employés" listant, recherchant, filtrant, ouvrant, ajoutant et supprimant les documents de tous les employés, avec visibilité sur les documents manquants/expirés/à renouveler.

**Independent Test**: Se connecter en RH, ouvrir "Documents employés", rechercher un employé, filtrer par catégorie/statut, ouvrir un document, en ajouter un, en supprimer un avec confirmation.

### Implementation for User Story 1

- [X] T009 [US1] Créer `app/Services/DocumentsEmployesService.php` avec une méthode `listeGlobale(?string $q, ?string $categorie, ?string $statut)` qui joint les documents actifs de tous les employés à leurs informations (`nom`, `prenom`, `matricule`) et synthétise les entrées "manquant" (catégories `obligatoire` non présentes pour un employé, voir data-model.md § Entité dérivée)
- [X] T010 [US1] Ajouter la route `GET /documents-employes` dans `backend/routes/api.php` et la méthode `PieceJointeController::indexGlobal(Request $request)` qui appelle `DocumentsEmployesService::listeGlobale()` avec pagination, conforme au contrat `GET /documents-employes` de contracts/documents-employes-api.md
- [X] T011 [US1] Étendre la validation de `PieceJointeController::store()` dans `backend/app/Http/Controllers/PieceJointeController.php` pour accepter `date_expiration` (nullable, date) et `obligatoire` (nullable, boolean), limiter `categorie` aux valeurs de `DocumentsEmployesReference::CATEGORIES`
- [X] T012 [P] [US1] Créer `frontend/src/components/DocumentsEmployesPage/DocumentsEmployesPage.jsx` et `DocumentsEmployesPage.css` : liste globale via `ui/Table`, champ de recherche (nom/matricule), filtres catégorie/statut (utilisant `frontend/src/constants/documentsEmployes.js`), badges de statut via `ui/Badge`, états chargement/erreur/vide
- [X] T013 [US1] Ajouter le formulaire d'ajout de document (fichier, catégorie, description, date d'expiration, obligatoire) dans `DocumentsEmployesPage.jsx`, réutilisant `ui/Modal` et `ui/FormField`, appelant `POST /employes/{id}/pieces-jointes` (dépend de T012)
- [X] T014 [US1] Ajouter l'action de suppression avec confirmation (`ui/Modal`) dans `DocumentsEmployesPage.jsx`, appelant `DELETE /pieces-jointes/{id}` et rafraîchissant la liste (dépend de T012)
- [X] T015 [US1] Ajouter un lien depuis chaque ligne de document vers la fiche de l'employé correspondant (navigation vers la route existante de fiche employé) dans `DocumentsEmployesPage.jsx` (dépend de T012)
- [X] T016 [US1] Ajouter l'entrée de menu "Documents employés" pour le rôle `rh` et retirer l'entrée `absences` du même rôle dans `frontend/src/components/Sidebar/Sidebar.jsx` (icône `FileCheck2` ou équivalent déjà utilisée dans `FicheEmploye.jsx`)
- [X] T017 [US1] Ajouter la route protégée `/documents-employes` (`allowedRoles={['rh']}`) pointant vers `DocumentsEmployesPage` dans `frontend/src/App.jsx`
- [X] T018 [US1] Mettre à jour l'onglet "Documents" de `frontend/src/components/FicheEmploye/FicheEmploye.jsx` pour afficher `statut` (badge) et `date_expiration`, et exposer les mêmes champs dans le formulaire d'upload existant

**Checkpoint**: User Story 1 fonctionnelle et testable indépendamment (MVP RH).

---

## Phase 4: User Story 2 - Un employé consulte ses propres documents (Priority: P2)

**Goal**: Un employé connecté consulte uniquement ses propres documents depuis son profil, sans accès à ceux des autres.

**Independent Test**: Se connecter en tant qu'employé, ouvrir le profil, vérifier que seuls ses documents apparaissent ; tenter d'accéder aux documents d'un autre employé et vérifier le refus.

### Implementation for User Story 2

- [X] T019 [US2] Ajouter la route `GET /moi/pieces-jointes` dans `backend/routes/api.php` et la méthode `PieceJointeController::mesPieces(Request $request)` qui résout l'employé à partir de l'utilisateur authentifié (`$request->user()->employe`) sans accepter d'identifiant client, conforme au contrat
- [X] T020 [US2] Ajouter la vérification d'autorisation dans `PieceJointeController::download()` (`backend/app/Http/Controllers/PieceJointeController.php`) : `403` si l'utilisateur authentifié est un employé et que le document ne lui appartient pas (dépend de T007)
- [X] T021 [US2] Remplacer le `Placeholder` de la route `profil` dans `frontend/src/App.jsx` par une page affichant "Mes documents" (nouveau composant ou réutilisation en lecture seule de la logique documents de `FicheEmploye.jsx`), consommant `GET /moi/pieces-jointes` et le téléchargement sécurisé (T007/T008)
- [X] T022 [US2] Retirer l'entrée `absences` du menu `employe` dans `frontend/src/components/Sidebar/Sidebar.jsx` (le profil devient l'accès aux documents personnels)

**Checkpoint**: User Stories 1 et 2 fonctionnelles indépendamment.

---

## Phase 5: User Story 3 - Le DG consulte les documents en lecture seule (Priority: P3)

**Goal**: Un DG consulte les documents des employés auxquels il a accès, sans pouvoir en ajouter ni en supprimer.

**Independent Test**: Se connecter en tant que DG, ouvrir la section documents, vérifier l'absence d'actions d'ajout/suppression.

### Implementation for User Story 3

- [X] T023 [US3] Ajouter un contrôle d'autorisation en lecture seule pour le rôle DG sur `PieceJointeController::store()` et `destroy()` dans `backend/app/Http/Controllers/PieceJointeController.php` (refus `403` dès qu'un guard/rôle DG authentifié est détecté ; voir research.md §5 pour l'état actuel du guard)
- [X] T024 [US3] Rendre `DocumentsEmployesPage.jsx` (`frontend/src/components/DocumentsEmployesPage/DocumentsEmployesPage.jsx`) capable d'un mode lecture seule (masquer les actions d'ajout/suppression) piloté par un prop/rôle `dg` (dépend de T012)
- [X] T025 [US3] Ajouter l'entrée "Documents employés" en lecture seule au menu `dg` dans `frontend/src/components/Sidebar/Sidebar.jsx` et la route protégée correspondante (`allowedRoles` incluant `dg`) dans `frontend/src/App.jsx`

**Checkpoint**: Les trois user stories sont fonctionnelles indépendamment.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Nettoyage final une fois que RH et Employé ne dépendent plus de la route `/absences`, et validation globale.

- [X] T026 [P] Retirer la route `absences` et le composant `Placeholder` associé de `frontend/src/App.jsx`, ainsi que l'import/usage de l'icône `CalendarCheck` désormais inutilisé dans `frontend/src/components/Sidebar/Sidebar.jsx` (FR-001 ; ne pas toucher au modèle/table `Absence` côté backend, FR-014)
- [X] T027 [P] Exécuter `php artisan test` et `./vendor/bin/pint` depuis `backend/`, corriger toute régression liée aux changements de `PieceJointe`/`PieceJointeController`
- [X] T028 [P] Exécuter `npm run lint` et `npm run build` depuis `frontend/`, corriger toute erreur de lint/build
- [X] T029 Exécuter manuellement les 7 scénarios de `specs/001-documents-employes/quickstart.md` et consigner les résultats

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Aucune dépendance — peut démarrer immédiatement
- **Foundational (Phase 2)**: Dépend de Setup — bloque toutes les user stories
- **User Stories (Phase 3-5)**: Dépendent toutes de la fin de Phase 2
  - US1 (P1) : aucune dépendance envers US2/US3
  - US2 (P2) : réutilise le téléchargement sécurisé de Phase 2 (T007/T008) ; indépendante de US1 sur le plan fonctionnel mais partage le même composant `PieceJointeController`
  - US3 (P3) : réutilise `DocumentsEmployesPage.jsx` créé en US1 (T012) pour son mode lecture seule — **dépendance technique de US3 envers T012 (US1)**, documentée explicitement ci-dessous
- **Polish (Phase 6)**: Dépend de la complétion des user stories livrées (au minimum US1 + US2 pour retirer proprement `/absences`, cf. T026)

### User Story Dependencies

- **User Story 1 (P1)**: Peut démarrer après Phase 2 — aucune dépendance envers les autres stories. Livrable seule comme MVP.
- **User Story 2 (P2)**: Peut démarrer après Phase 2, en parallèle de US1 — fonctionnellement indépendante (routes et composants propres), mais T026 (retrait de `/absences`) doit attendre que T016 **et** T022 soient faits.
- **User Story 3 (P3)**: Peut démarrer après Phase 2, mais **T024 dépend techniquement de T012** (réutilise le composant de US1). Si US3 doit être strictement indépendante, T012 peut être dupliqué au lieu d'être réutilisé — non retenu ici pour éviter la duplication de code sur un composant de liste identique.

### Parallel Opportunities

- T001 et T002 (Setup) en parallèle
- Au sein de Phase 2, T004 dépend de T003 ; T005/T006 dépendent de T004 ; T007 est indépendant des autres tâches de Phase 2 et peut être fait en parallèle de T003-T006 ; T008 dépend de T007
- Une fois Phase 2 terminée, US1 et US2 peuvent être menées en parallèle par deux développeurs différents
- Au sein de US1 : T012 peut démarrer en parallèle du travail backend (T009-T011) ; T013/T014/T015 dépendent de T012 et peuvent être séquencés par le même développeur
- T027 et T028 (Polish) en parallèle

---

## Parallel Example: User Story 1

```bash
# Backend et frontend en parallèle une fois Phase 2 terminée :
Task: "Créer app/Services/DocumentsEmployesService.php (T009)"
Task: "Créer frontend/src/components/DocumentsEmployesPage/DocumentsEmployesPage.jsx (T012)"
```

---

## Implementation Strategy

### MVP First (User Story 1 uniquement)

1. Phase 1 (Setup) → Phase 2 (Foundational, bloquant)
2. Phase 3 (User Story 1) → RH dispose de la section "Documents employés" complète
3. **STOP & VALIDER** : scénarios 1-4 de `quickstart.md`
4. Déployer/démontrer si prêt (Absences reste présente pour Employé/DG à ce stade, retirée seulement en Polish)

### Incremental Delivery

1. Setup + Foundational → socle prêt
2. User Story 1 → validation indépendante → MVP RH
3. User Story 2 → validation indépendante → self-service employé
4. User Story 3 → validation indépendante → supervision DG
5. Polish → retrait définitif de `/absences`, validation croisée complète

---

## Phase 7: Convergence

- [X] T030 CRITICAL: corriger `PieceJointeController::store()`, `download()` et `destroy()` dans `backend/app/Http/Controllers/PieceJointeController.php` pour stocker/lire les fichiers de `pieces_jointes` sur un disque privé (non `public`) au lieu de `Storage::disk('public')`, et retirer ou adapter `getUrlAttribute()` dans `backend/app/Models/PieceJointe.php` en conséquence per research.md §4 / plan.md Constraints (contradicts)
- [X] T031 ajouter dans `PieceJointeController::index($employe_id)` (`backend/app/Http/Controllers/PieceJointeController.php`) la même vérification d'appartenance employé (403 si le document demandé n'appartient pas à l'employé authentifié) que celle déjà présente dans `download()`, afin de couvrir tous les chemins d'accès per FR-010 (partial)
- [X] T032 corriger `PIECES_ACCEPT` dans `frontend/src/components/DocumentsEmployesPage/DocumentsEmployesPage.jsx` (`'.pdf,.jpg,.jpeg,.png,.doc,docx'` → `'.pdf,.jpg,.jpeg,.png,.doc,.docx'`) pour rester cohérent avec `FicheEmploye.jsx` et les types réellement acceptés par le backend per FR-012 (partial)

