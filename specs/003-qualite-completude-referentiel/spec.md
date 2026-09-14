# Feature Specification: Import/export Excel compatible avec la structure MySQL

**Feature Branch**: `003-qualite-completude-referentiel`
**Created**: 2026-09-14
**Status**: Draft

## User Scenarios & Testing

### User Story 1 - Importer un fichier Excel valide (Priority: P1)
Un administrateur importe un fichier Excel contenant les colonnes du référentiel employés et synchronise les lignes avec la base de données.

**Acceptance Scenarios**:
1. **Given** un fichier avec les en-têtes attendus et des valeurs texte ou numériques, **When** l'administrateur l'importe, **Then** les valeurs sont normalisées selon les types attendus par l'API et les employés sont créés ou mis à jour.
2. **Given** une colonne obligatoire absente, **When** l'administrateur importe le fichier, **Then** l'import est refusé avec le nom de la colonne manquante.
3. **Given** une valeur incompatible avec une colonne, **When** l'import est soumis, **Then** l'erreur identifie la ligne et le champ concernés.

### User Story 2 - Exporter un fichier réimportable (Priority: P1)
Un administrateur exporte les employés dans un fichier Excel qui respecte les types et noms de colonnes attendus par l'import.

**Acceptance Scenarios**:
1. **Given** des employés en base, **When** l'administrateur exporte le fichier, **Then** les colonnes correspondent au modèle d'import et les champs texte sont exportés comme texte.
2. **Given** un matricule avec des zéros initiaux, **When** le fichier exporté est ouvert puis réimporté, **Then** le matricule conserve sa valeur exacte.
3. **Given** un export sans employé, **When** le fichier est téléchargé, **Then** il contient au minimum les en-têtes valides.

## Requirements

- **FR-001**: Le système MUST accepter les cellules Excel typées texte, nombre ou date lorsqu'elles correspondent à un champ API valide.
- **FR-002**: Le système MUST envoyer les champs texte comme chaînes et préserver les identifiants, y compris les zéros initiaux.
- **FR-003**: Le système MUST conserver les champs numériques et dates compatibles avec les règles de validation backend.
- **FR-004**: L'export MUST utiliser les mêmes noms métier et l'ordre de colonnes documenté par le modèle d'import.
- **FR-005**: L'export MUST marquer les champs texte comme texte dans le classeur Excel.
- **FR-006**: Les erreurs de validation MUST rester lisibles et associer le champ à la ligne importée.

## Assumptions

- La structure persistée reste celle du modèle Laravel `Employe` et de ses règles de validation existantes.
- Le fichier de transport est `.xlsx`; aucun changement de schéma MySQL n'est requis.
- L'import est limité à 500 employés par requête, conformément à l'API actuelle.

## User Story 3 - Confirmer les changements après synchronisation (Priority: P1)

Un administrateur reçoit un message de confirmation après la synchronisation du fichier Excel, indiquant le résultat réel dans la base de données.

**Acceptance Scenarios**:
1. **Given** des lignes créées ou modifiées, **When** la synchronisation réussit, **Then** l'interface affiche le nombre d'employés créés et modifiés.
2. **Given** un fichier sans différence avec la base, **When** la synchronisation réussit, **Then** l'interface affiche qu'aucun changement n'a été effectué.
3. **Given** une erreur de validation ou de synchronisation, **When** l'appel échoue, **Then** aucun message de succès n'est affiché et l'erreur reste visible.

## Additional Requirements

- **FR-007**: The synchronization response MUST distinguish created, modified, and unchanged rows.
- **FR-008**: The frontend MUST display a success confirmation only after a successful API response.
- **FR-009**: The confirmation MUST state whether the database changed and include created/modified/unchanged counts.
