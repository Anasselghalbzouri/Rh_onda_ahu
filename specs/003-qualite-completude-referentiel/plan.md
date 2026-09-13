# Implementation Plan: Qualité et Complétude du Référentiel

**Branch**: `003-qualite-completude-referentiel` | **Date**: 2026-09-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-qualite-completude-referentiel/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Remplacer le calcul actuel et erroné du compteur « Dossier complet » (basé sur le taux de validation des pièces jointes, `FicheEmploye.jsx:219`, qui vaut 0 % dès qu'aucun document n'est attaché) par un calcul de complétude piloté par une table de règles configurables (`regle_completude`). Le taux et les champs manquants sont calculés et persistés sur chaque employé (recalcul à l'enregistrement + job nocturne), exposés via de nouveaux endpoints API pour trois écrans React (dossiers incomplets par service, taux par service/catégorie, rapport d'import), et appliqués comme garde-fou lors de l'import Excel existant (`ImportController::syncFromExcel`) pour rejeter — plutôt qu'accepter avec un tiret — toute ligne incomplète pour un agent actif.

## Technical Context

**Language/Version**: PHP 8.3 (Laravel 13) pour le backend ; JavaScript/JSX (React 19, Vite) pour le frontend — stack déjà en place, aucune nouvelle techno introduite.

**Primary Dependencies**: Laravel (Eloquent, Task Scheduling, Queue), PhpSpreadsheet (déjà utilisé par `ImportController`) ; React 19 + `api` client Axios déjà utilisé par les pages `Rapport*Page` existantes.

**Storage**: SQLite (`database/database.sqlite`), driver `database` pour sessions/cache/queue — conforme à l'existant. Nouvelle table `regle_completude` + nouvelles colonnes sur `employe` (`taux_completude`, `champs_manquants`, `date_dernier_calcul`) + nouvelle table `import_rapport`/`import_rapport_ligne` pour l'historique des imports.

**Testing**: `php artisan test` (Pest/PHPUnit, Feature tests avec SQLite en mémoire) côté backend ; pas de suite de tests frontend automatisée en place aujourd'hui — validation manuelle via `npm run dev` comme pour les autres pages `Rapport*Page`.

**Target Platform**: Application web interne (navigateur desktop), backend Laravel servi en HTTP, déploiement existant (voir `backend/docs/`).

**Project Type**: Web application (backend API Laravel + frontend SPA React), déjà en place sous forme de deux dossiers `backend/` et `frontend/` — pas de Blade pour cette fonctionnalité : le SPA React est servi par `routes/web.php` (`$serveSpa`) et consomme l'API sous `routes/api.php`, à l'image de `RapportActiviteController`/`RapportActivitePage` et `RapportEmployesController`/`RapportEmployesPage`.

**Performance Goals**: Le recalcul à l'enregistrement d'une fiche doit rester imperceptible pour l'utilisateur (<200ms ajouté à la requête de sauvegarde) ; le recalcul nocturne doit traiter l'ensemble des employés (échelle actuelle : quelques milliers de lignes) en une seule exécution planifiée sans bloquer les autres jobs.

**Constraints**: Ne pas casser les usages existants de `Employe` (relations, `fillable`, `$table = 'employe'`) ni les deux chemins d'import déjà en production (`ImportController::importFromFile` et `::syncFromExcel`, utilisés respectivement par l'upload manuel et par la synchronisation Excel automatique documentée dans la mémoire projet). Les règles de rejet ne doivent s'appliquer qu'aux agents actifs, conformément à FR-002/FR-011.

**Scale/Scope**: 3 écrans React, 1 nouvelle table de règles, extension du modèle `Employe`, extension du contrôleur d'import existant, 1 job planifié quotidien, exposition de données consommées par le tableau de bord existant (`Dashboard.jsx`) et par `FicheEmploye.jsx`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Le fichier `.specify/memory/constitution.md` du dépôt est encore le gabarit non renseigné (aucun principe concret défini) : aucune règle de gouvernance projet ne s'applique au-delà des conventions déjà observées dans le code (Laravel + React séparés, contrôleurs API sous `routes/api.php`, migrations pour tout changement de schéma). Gate considérée comme passée par absence de contraintes formelles ; aucune violation à justifier.

## Project Structure

### Documentation (this feature)

```text
specs/003-qualite-completude-referentiel/
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
│   ├── Models/
│   │   ├── Employe.php                     # étendu : taux_completude, champs_manquants, date_dernier_calcul + accessor
│   │   ├── RegleCompletude.php              # nouveau
│   │   ├── ImportRapport.php                # nouveau
│   │   └── ImportRapportLigne.php           # nouveau
│   ├── Services/
│   │   └── CompletudeService.php            # nouveau : calcule taux/champs manquants pour un employé ou en lot
│   ├── Http/Controllers/
│   │   ├── CompletudeController.php         # nouveau : dossiers incomplets, taux par service/catégorie
│   │   ├── ImportController.php             # étendu : validation de complétude avant écriture, rejet + motif
│   │   └── EmployeController.php            # étendu : déclenche le recalcul après store/update
│   └── Console/Commands/
│       └── RecalculerCompletude.php         # nouveau : job/commande planifiée nocturne
├── database/migrations/
│   ├── ..._create_regle_completude_table.php
│   ├── ..._add_completude_fields_to_employe_table.php
│   └── ..._create_import_rapport_tables.php
└── routes/
    ├── api.php                              # nouvelles routes /completude/*, /import/rapports
    └── console.php                          # planification du recalcul nocturne (schedule)

frontend/
└── src/components/
    ├── CompletudePage/                      # nouveau : écrans "dossiers incomplets" + "taux par service/catégorie"
    │   ├── CompletudePage.jsx
    │   └── CompletudePage.css
    ├── ui/ImportExcelModal/                  # étendu : affichage lignes rejetées + motif (rapport d'import)
    ├── FicheEmploye/FicheEmploye.jsx          # corrigé : "Dossier complet" lit employe.taux_completude au lieu de dossierPersonnel
    └── Dashboard/Dashboard.jsx                # étendu : consomme les nouvelles statistiques de fiabilité par service
```

**Structure Decision**: Application web existante à deux dossiers (`backend/` Laravel API, `frontend/` React SPA). Cette feature n'introduit ni Blade ni nouveau projet : tout endpoint est ajouté sous `routes/api.php` et consommé par de nouveaux composants React sous `frontend/src/components/`, en suivant exactement le patron déjà utilisé par `RapportActiviteController` + `RapportActivitePage` et `RapportEmployesController` + `RapportEmployesPage`. Le bug identifié dans `FicheEmploye.jsx` (calcul de complétude basé sur les pièces jointes) est corrigé pour lire le nouveau champ persistant `employe.taux_completude`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Aucune violation : la constitution du projet n'impose aucune contrainte formelle (fichier encore au stade gabarit) et la structure retenue réutilise les patrons déjà en place.
