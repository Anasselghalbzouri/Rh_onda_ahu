# Phase 1 Data Model: Refonte du Rapport d'Activité PS09 et Export des Données Employés

Aucune nouvelle table ni migration n'est nécessaire : cette fonctionnalité lit exclusivement les entités Eloquent existantes. Ce document décrit la **vue de données** produite par le rapport (projection), pas de nouveau schéma de persistance.

## Entité source : `Employe` (existant, `backend/app/Models/Employe.php`)

Table : `employes`. Colonnes déjà présentes, réutilisées telles quelles pour le rapport données employés.

| Colonne | Type | Inclus dans le rapport employés ? | Notes |
|---|---|---|---|
| `matricule` | string | Oui | Identifiant métier de l'employé |
| `nom`, `prenom` | string | Oui | Identité |
| `sexe` | string | Oui | |
| `date_naissance` | date | Oui | |
| `date_embauche` | date | Oui | |
| `categorie`, `echelle`, `echelon` | string | Oui | Classification |
| `entite` | string | Oui | |
| `fonction`, `qualification` | string | Oui | |
| `service_id` | FK → `service` | Oui (résolu en nom de service via la relation `service()`) | |
| `affectation`, `date_affectation` | string / date | Oui | |
| `mutation`, `date_mutation` | bool / date | Oui | Statut de carrière |
| `retraite`, `date_retraite` | bool / date | Oui | Statut de carrière |
| `depart_volontaire`, `date_depart_volontaire` | bool / date | Oui | Statut de carrière |
| `statut` | string | Oui | |
| `observation` | text | Oui (optionnel — commentaire administratif libre, pas lié aux congés/maladies) | |
| `solde_conge` | float | **Non — exclu (FR-002)** | Donnée de congé |
| relation `demandesConge()` | hasMany `DemandeConge` | **Non — exclu (FR-002)** | |
| relation `absences()` | hasMany `Absence` | **Non — exclu (FR-002)** | Couvre notamment les absences maladie |

**Validation rule** : la requête de génération du rapport DOIT utiliser une sélection de colonnes explicite (`select([...])` / accesseurs dédiés) reprenant uniquement la liste "Oui" ci-dessus, et ne DOIT jamais `with('demandesConge')`, `with('absences')`, ni exposer `solde_conge`.

## Entité de référence : `Service` (existant, `backend/app/Models/Service.php`)

Utilisée uniquement pour résoudre `service_id` → nom du service (colonne `nom`) affiché dans le rapport, et pour le filtre optionnel par service (FR-003).

## Vue projetée : `EmployeRapportRow` (non persistée — DTO/tableau produit par le contrôleur)

Représente une ligne du rapport exporté. Construite à la volée à partir d'`Employe` (+ `Service` en jointure/eager-load restreint à `nom`) :

| Champ exposé | Source |
|---|---|
| Matricule | `employe.matricule` |
| Nom | `employe.nom` |
| Prénom | `employe.prenom` |
| Sexe | `employe.sexe` |
| Date de naissance | `employe.date_naissance` |
| Date d'embauche | `employe.date_embauche` |
| Catégorie | `employe.categorie` |
| Échelle | `employe.echelle` |
| Échelon | `employe.echelon` |
| Entité | `employe.entite` |
| Fonction | `employe.fonction` |
| Qualification | `employe.qualification` |
| Service | `employe.service.nom` (ou « Non renseigné » si absent — cf. Edge Cases spec) |
| Affectation | `employe.affectation` |
| Date d'affectation | `employe.date_affectation` |
| Statut carrière | dérivé de `mutation` / `retraite` / `depart_volontaire` (+ date associée) |
| Statut | `employe.statut` |

**State transitions** : aucune — cette vue est une lecture seule à un instant T, sans cycle de vie propre.

## Filtre de génération (paramètres d'entrée, non persistés)

| Paramètre | Type | Obligatoire | Description |
|---|---|---|---|
| `service_id` | integer, existe dans `service` | Non | Restreint le rapport aux employés du service donné |
| `statut` | string | Non | Restreint le rapport aux employés ayant ce statut (ex. actif/inactif, selon les valeurs déjà utilisées dans `employes.statut`) |
