# Implementation Plan: Refonte du Rapport d'Activité PS09 et Export des Données Employés

**Branch**: `002-rapport-activite-employes` | **Date**: 2026-09-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-rapport-activite-employes/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Ajouter un nouvel export « Rapport données employés » (Excel, généré à la demande via PhpSpreadsheet, filtrable par service/statut) listant les informations d'identité et de carrière de chaque employé en excluant explicitement congés/maladies/absences, et consolider — sans les étendre — les indicateurs Formation/Effectif déjà automatisés dans l'export PS09 existant (`RapportActiviteController` + `XlsxSurgicalPatcher`), sans toucher aux graphiques natifs du classeur.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: PHP 8.3 (Laravel 13) pour le backend ; JavaScript (React 19, Vite) pour le frontend

**Primary Dependencies**: `phpoffice/phpspreadsheet` (déjà présent, ^5.7) pour générer le fichier Excel du rapport employés ; `App\Services\XlsxSurgicalPatcher` (existant) pour le PS09 ; Eloquent (`App\Models\Employe`) pour la lecture des données ; `axios` (`frontend/src/api.js`) côté React

**Storage**: SQLite (`database/database.sqlite`), via le modèle Eloquent `Employe` existant — aucune nouvelle table requise

**Testing**: `php artisan test` (Pest/PHPUnit, tests Feature existants sous `backend/tests/`) pour les nouveaux endpoints ; vérification manuelle du rendu React (pas de suite de tests frontend en place actuellement)

**Target Platform**: Application web (backend Laravel exposé en API, consommé par la SPA React `frontend/`)

**Project Type**: Web application (backend + frontend séparés, cf. CLAUDE.md)

**Performance Goals**: Génération et téléchargement du rapport employés en moins de 30s pour l'effectif actuel de la plateforme (quelques centaines d'employés) — cf. SC-001

**Constraints**: Ne pas modifier les graphiques natifs ni la mise en forme du classeur PS09 (contrainte déjà respectée par `XlsxSurgicalPatcher`, à préserver) ; exclure strictement toute donnée de congé/maladie/absence du nouveau rapport ; accès restreint aux utilisateurs authentifiés `auth:rh`

**Scale/Scope**: Un nouvel endpoint d'export + une page frontend (ou une extension de la page PS09 existante) ; volume de données correspondant à la table `Employe` actuelle (pas de traitement asynchrone/file d'attente nécessaire)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Le fichier `.specify/memory/constitution.md` est un gabarit non renseigné (aucun principe de projet défini) — aucune porte de gouvernance formelle à évaluer. Le plan suit néanmoins les conventions déjà en place dans le dépôt (voir CLAUDE.md) : réutilisation des patterns Laravel MVC existants, pas de nouvelle dépendance, pas de sur-ingénierie (pas de file d'attente/traitement asynchrone pour un volume de données modeste). Aucune violation à justifier.

## Project Structure

### Documentation (this feature)

```text
specs/002-rapport-activite-employes/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Http/Controllers/
│   │   ├── RapportActiviteController.php   # existant — consolidation Formation/Effectif
│   │   └── RapportEmployesController.php   # nouveau — export "données employés"
│   ├── Services/
│   │   └── XlsxSurgicalPatcher.php         # existant, réutilisé tel quel pour le PS09
│   └── Models/
│       └── Employe.php                     # existant, source de données du rapport employés
├── routes/api.php                          # ajout des routes /rapport-employes(/export)
└── tests/Feature/
    ├── RapportActiviteTest.php             # existant, à faire évoluer si besoin
    └── RapportEmployesTest.php             # nouveau

frontend/
└── src/
    ├── components/
    │   ├── RapportActivitePage/            # existant, inchangé dans sa logique PS09
    │   └── RapportEmployesPage/            # nouveau composant + page de filtre/export
    ├── App.jsx                             # ajout de la route vers la nouvelle page
    └── components/Sidebar/Sidebar.jsx      # ajout de l'entrée de menu correspondante
```

**Structure Decision**: Web application à deux projets séparés (`backend/` Laravel API, `frontend/` React SPA), conforme à la structure existante décrite dans `CLAUDE.md`. Le nouveau rapport employés est implémenté comme un contrôleur Laravel dédié (`RapportEmployesController`) plutôt qu'en étendant `RapportActiviteController`, car il s'agit d'une ressource distincte (export employés vs. export PS09 trimestriel) avec ses propres filtres et son propre format de sortie ; le PS09 existant n'est pas modifié dans sa structure, seule sa logique de calcul est consolidée.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Aucune violation — section non applicable (pas de gate constitutionnelle définie, pas d'écart de complexité introduit par ce plan).
