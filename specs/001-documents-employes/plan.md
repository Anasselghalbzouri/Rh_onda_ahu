# Implementation Plan: Documents employés (remplace Absences)

**Branch**: `001-documents-employes` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-documents-employes/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Retirer la section "Absences" (aujourd'hui un simple placeholder de navigation, non fonctionnelle) de la navigation RH et Employé, et la remplacer par une section "Documents employés" qui complète la gestion documentaire déjà partiellement implémentée (modèle `PieceJointe`, contrôleur `PieceJointeController`, onglet Documents de `FicheEmploye.jsx`). Approche technique : étendre l'entité `PieceJointe` existante (nouvelles colonnes `date_expiration`, `statut`, `obligatoire`, `supprime_par`) plutôt que créer un nouveau modèle, ajouter une vue globale RH avec recherche/filtres, sécuriser le téléchargement via une route protégée (au lieu de l'URL publique actuelle), et conserver intégralement les données/modèle `Absence` en base.

## Technical Context

**Language/Version**: PHP 8.3 (Laravel 13) côté backend ; JavaScript (React 19, Vite) côté frontend

**Primary Dependencies**: Laravel Sanctum (auth API, guard `rh` existant), `laravel-vite-plugin` ; React Router (routes SPA), `lucide-react` (icônes), composants internes `ui/Table`, `ui/Modal`, `ui/Badge`, `ui/FormField`

**Storage**: SQLite en développement (`backend/database/database.sqlite`), disque de fichiers Laravel (`storage/app/public`) pour les pièces jointes. Schéma des tables métier (`employes`, `pieces_jointes`, `absences`, …) provisionné hors des migrations de ce dépôt (voir research.md §1/§6) — toute nouvelle migration de cette feature doit rester compatible avec cet environnement

**Testing**: `php artisan test` (Pest/PHPUnit, backend) ; `npm run lint` (ESLint, frontend) — pas de suite de tests frontend automatisée constatée dans le dépôt actuel

**Target Platform**: Application web servie par Laravel (SPA React livrée en build statique dans `public/`, cf. `routes/web.php`), déploiement Docker (2 conteneurs, SQLite) selon la mémoire projet

**Project Type**: Web application (backend Laravel + frontend React séparé, cf. structure du dépôt)

**Performance Goals**: Pas d'exigence chiffrée spécifique au-delà de SC-001 (retrouver et ouvrir un document en moins de 30 secondes) ; volumétrie attendue à l'échelle d'un aéroport (centaines d'employés, quelques documents chacun) ne nécessite pas d'optimisation particulière au-delà d'une pagination simple sur la liste globale

**Constraints**: Ne pas exposer les fichiers via une URL publique directe (FR-005/FR-012, research.md §4) ; ne supprimer aucune donnée ni table liée aux absences (FR-014) ; respecter les rôles RH/Employé/DG déjà utilisés ailleurs dans l'app, en tenant compte du fait que seul le rôle RH est aujourd'hui authentifié côté backend (research.md §5)

**Scale/Scope**: 3 user stories (RH complet, Employé lecture propre, DG lecture seule), 1 entité étendue (`PieceJointe`), ~5 endpoints (1 nouveau global, 1 nouveau téléchargement, 1 nouveau "mes documents", 2 étendus), 1 nouvelle page frontend + amélioration d'un onglet existant, retrait de 2-3 points de navigation existants

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` ne contient que les placeholders du modèle (`[PRINCIPLE_1_NAME]`, etc.) — aucun principe projet n'a été ratifié pour ce dépôt. Aucune règle constitutionnelle concrète ne s'applique donc à ce stade ; ce gate est traité comme **passé par absence de contraintes définies**. Si une constitution est adoptée ultérieurement, ce plan devra être réévalué.

## Project Structure

### Documentation (this feature)

```text
specs/001-documents-employes/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── documents-employes-api.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Models/
│   │   └── PieceJointe.php               # étendu : date_expiration, statut, obligatoire, supprime_par
│   ├── Http/Controllers/
│   │   └── PieceJointeController.php     # étendu : index global, download sécurisé, "mes documents"
│   └── (Absence.php, DossierPersonnel.php inchangés — hors périmètre, voir research.md)
├── database/migrations/
│   └── [nouvelle] add_statut_expiration_obligatoire_to_pieces_jointes.php
└── routes/api.php                         # nouvelles routes : /documents-employes, /pieces-jointes/{id}/download, /moi/pieces-jointes

frontend/
├── src/
│   ├── components/
│   │   ├── Sidebar/Sidebar.jsx            # retrait de l'entrée "absences" (rh, employe)
│   │   ├── DocumentsEmployesPage/         # nouvelle page RH (liste globale, recherche, filtres)
│   │   │   ├── DocumentsEmployesPage.jsx
│   │   │   └── DocumentsEmployesPage.css
│   │   ├── FicheEmploye/FicheEmploye.jsx  # onglet Documents amélioré (statut, expiration)
│   │   └── ui/ (Table, Modal, Badge, FormField)  # réutilisés tels quels
│   └── App.jsx                            # route /absences retirée, route /documents-employes ajoutée
```

**Structure Decision**: Application web à deux projets séparés déjà en place (`backend/` Laravel API, `frontend/` SPA React). Cette feature ne modifie pas cette séparation : elle étend le modèle et le contrôleur `PieceJointe` existants côté backend (pas de nouveau bounded context), et ajoute une page React dédiée côté frontend tout en réutilisant les composants `ui/` déjà partagés par les autres pages (`PersonnelPage`, `CongesPage`, etc.), conformément aux conventions déjà en usage dans le dépôt.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

N/A — aucune constitution ratifiée pour ce projet (voir Constitution Check ci-dessus), donc aucune violation à justifier.
