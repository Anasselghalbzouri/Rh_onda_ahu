# Phase 0 Research: Refonte du Rapport d'Activité PS09 et Export des Données Employés

Toutes les inconnues de la spécification ont été résolues durant `/speckit-specify` (le périmètre PS09 est confirmé limité à la consolidation de Formation/Effectif). Ce document couvre les décisions techniques nécessaires pour passer à la conception (Phase 1).

## 1. Génération du fichier Excel du rapport employés

- **Decision**: Utiliser `phpoffice/phpspreadsheet` (déjà une dépendance du projet, `^5.7`) pour générer un classeur `.xlsx` autonome (une feuille, une ligne par employé, en-têtes de colonnes) plutôt que de réutiliser `XlsxSurgicalPatcher`.
- **Rationale**: `XlsxSurgicalPatcher` a été conçu spécifiquement pour patcher chirurgicalement des cellules dans un classeur maître PS09 existant sans toucher à ses graphiques natifs (cf. `backend/app/Services/XlsxSurgicalPatcher.php`). Le rapport employés n'a pas de classeur maître avec mise en forme/graphiques à préserver : c'est une génération de données tabulaires simples, cas d'usage standard de PhpSpreadsheet, déjà présent dans les dépendances (aucun ajout de package).
- **Alternatives considered**:
  - Réutiliser `XlsxSurgicalPatcher` sur un nouveau template vide → rejeté : sur-complexité inutile pour un simple export tabulaire, ce service est pensé pour un classeur existant avec structure figée.
  - Export CSV → rejeté : la spec (FR-004, User Story 3) demande explicitement un format tableur Excel cohérent avec l'existant PS09, et un `.xlsx` s'ouvre nativement dans Excel avec typage des colonnes (dates, nombres) contrairement au CSV.
  - Librairie `maatwebsite/laravel-excel` → rejeté : ajouterait une dépendance alors que `phpoffice/phpspreadsheet` (sur lequel elle repose) est déjà disponible et suffisant pour ce besoin simple.

## 2. Source des données employé et exclusion des congés/maladies

- **Decision**: Requêter directement le modèle `App\Models\Employe` (table `employes`) en sélectionnant uniquement les colonnes administratives listées en FR-001 (matricule, nom, prénom, sexe, date_naissance, date_embauche, categorie, echelle, echelon, entite, fonction, qualification, service (relation `service()`), affectation, date_affectation, mutation/date_mutation, retraite/date_retraite, depart_volontaire/date_depart_volontaire, statut). Ne jamais charger/joindre les relations `demandesConge()` ou `absences()`.
- **Rationale**: Le modèle `Employe` (backend/app/Models/Employe.php) expose déjà `solde_conge` en colonne native et des relations `demandesConge()`/`absences()` vers des tables dédiées. En sélectionnant explicitement les colonnes du rapport (et en excluant `solde_conge` et toute relation congé/absence), on respecte FR-002 par construction, sans risque d'inclusion accidentelle même si le modèle évolue.
- **Alternatives considered**: Charger l'employé complet puis masquer les champs sensibles côté export → rejeté : plus fragile (un nouveau champ sensible ajouté au modèle serait exposé par défaut) ; la sélection explicite de colonnes est un contrôle positif plus sûr.

## 3. Filtrage du rapport (service / statut)

- **Decision**: Exposer des paramètres de requête optionnels `service_id` et `statut` sur l'endpoint d'export, appliqués via des clauses `where` conditionnelles sur `Employe`, cohérent avec le pattern de validation déjà utilisé dans `RapportActiviteController::stats()` (`$request->validate([...])`).
- **Rationale**: FR-003 exige un filtrage optionnel ; le modèle expose déjà une colonne `statut` et une relation `service()`. Réutiliser le pattern `Request::validate()` déjà en place garantit la cohérence avec le reste du contrôleur PS09.
- **Alternatives considered**: Filtrage côté frontend uniquement après récupération de tous les employés → rejeté : plus lent, transfère des données non nécessaires, et ne passe pas à l'échelle si l'effectif grossit.

## 4. Consolidation des indicateurs PS09 (Formation/Effectif)

- **Decision**: Revue du calcul existant dans `RapportActiviteController::computeStats()` pour fiabiliser les critères déjà en place (ex. `realisees` basé sur `date_fin < now()`, `evaluees`/`efficaces` basés sur la relation `evaluations`), sans ajouter de nouvel indicateur ni modifier la structure du classeur ou les graphiques (confirmé avec l'utilisateur : périmètre limité à Formation/Effectif).
- **Rationale**: Le périmètre a été explicitement validé lors de `/speckit-specify` (option « Se limiter à Formation/Effectif »). Toute anomalie de calcul identifiée (ex. edge cases sur les dates de trimestre) sera traitée comme une correction, pas comme un nouvel indicateur.
- **Alternatives considered**: Étendre les indicateurs automatisés (accidents du travail, polyvalence, etc.) → explicitement écarté par l'utilisateur, faute de source de données dédiée dans la plateforme.

## 5. Emplacement dans l'interface (frontend)

- **Decision**: Créer une nouvelle page `RapportEmployesPage` (nouveau composant sous `frontend/src/components/`), accessible via une nouvelle entrée de la `Sidebar`, distincte de `RapportActivitePage` (PS09).
- **Rationale**: Les deux rapports ont des publics/flux différents (un export ponctuel trimestriel structuré vs. un export filtrable de la liste du personnel) ; les séparer évite de surcharger l'écran PS09 existant et respecte l'architecture actuelle où chaque rapport a sa propre page (cf. `RapportActivitePage.jsx`).
- **Alternatives considered**: Ajouter un onglet dans la page PS09 existante → rejeté : mélangerait deux logiques métier distinctes (trimestriel calculé vs. état du personnel filtrable) dans un seul composant, complexifiant sa maintenance.
