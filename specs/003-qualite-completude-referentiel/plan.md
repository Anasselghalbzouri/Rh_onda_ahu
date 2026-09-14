# Implementation Plan: Import/export Excel compatible avec la structure MySQL

**Branch**: `003-qualite-completude-referentiel` | **Date**: 2026-09-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Normaliser les valeurs Excel à l'import et typer explicitement les colonnes texte à l'export afin que les fichiers soient réimportables dans la structure Laravel/MySQL existante, en particulier pour les matricules avec zéros initiaux.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: PHP 8.3, JavaScript/React 19

**Primary Dependencies**: Laravel 13, PhpSpreadsheet, Vite, SheetJS (`xlsx`)

**Storage**: Laravel database schema, MySQL-compatible; SQLite local default

**Testing**: PHPUnit/Pest via Laravel, PHP lint, Vite production build

**Target Platform**: Web browser plus Laravel API server

**Project Type**: Web application monorepo (React SPA + Laravel API)

**Performance Goals**: Import/export up to 500 employee rows within the existing synchronous API limit

**Constraints**: Preserve API validation and existing headers; no schema migration; preserve leading zeroes

**Scale/Scope**: Personnel import/export flow and employee bulk-sync endpoint

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

No `.specify/memory/constitution.md` exists in the repository, so no additional constitution gates are defined. The design reuses existing endpoints and avoids a database migration.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
backend/
frontend/
```

**Structure Decision**: Keep the existing monorepo structure. The frontend adapter is `frontend/src/components/ui/ImportExcelModal/ImportExcelModal.jsx`; the backend export is `backend/app/Exports/EmployeExport.php`; bulk validation remains in `backend/app/Http/Controllers/EmployeController.php`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
