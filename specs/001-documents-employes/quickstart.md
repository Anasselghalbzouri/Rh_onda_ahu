# Quickstart: Documents employés (remplace Absences)

Guide de validation manuelle une fois la feature implémentée. Références : [data-model.md](./data-model.md), [contracts/documents-employes-api.md](./contracts/documents-employes-api.md).

## Prérequis

- Backend Laravel lancé (`composer run dev` depuis `backend/`), migrations appliquées (`php artisan migrate`).
- Frontend lancé (`npm run dev` depuis `frontend/`).
- Au moins un compte RH existant (`responsable_rh`) et au moins un employé avec des documents de test (via l'onglet Documents de la fiche employé ou directement via l'API).

## Scénario 1 — Navigation (FR-001, FR-002)

1. Se connecter en tant que RH.
2. Vérifier que l'entrée de menu "Absences" n'apparaît plus dans la barre latérale.
3. Vérifier que l'entrée "Documents employés" apparaît et mène à la nouvelle page listant les documents de tous les employés.
4. Naviguer directement vers l'ancienne URL `/absences` : elle ne doit plus être accessible depuis la navigation (voir Assumptions du spec pour le traitement des liens existants).

**Résultat attendu** : SC-002 validé.

## Scénario 2 — Recherche, filtres, ouverture (FR-003 à FR-005)

1. Depuis "Documents employés", rechercher un employé par nom, puis par matricule.
2. Filtrer par catégorie (ex. "CIN") puis par statut (ex. "Expiré").
3. Ouvrir/télécharger un document existant et vérifier qu'il s'affiche correctement.

**Résultat attendu** : SC-001 validé (moins de 30 secondes pour retrouver et ouvrir un document).

## Scénario 3 — Ajout et suppression (FR-006, FR-007, FR-012, FR-013)

1. Ajouter un document pour un employé avec une catégorie et, optionnellement, une date d'expiration.
2. Vérifier qu'un fichier non conforme (mauvais type ou trop volumineux) est refusé avec un message clair.
3. Supprimer un document : vérifier qu'une confirmation est demandée avant suppression effective.
4. Vérifier (via les données, ou un futur écran d'audit) que l'identité de l'utilisateur ayant ajouté/supprimé le document est conservée.

## Scénario 4 — Statuts (FR-008, FR-015, SC-004)

1. Créer un document avec une date d'expiration passée → doit apparaître "Expiré".
2. Créer un document avec une date d'expiration dans moins de 30 jours → doit apparaître "À renouveler".
3. Marquer une catégorie comme obligatoire pour un employé qui ne l'a pas fournie → elle doit apparaître "Manquant" dans la liste RH sans qu'aucune action supplémentaire ne soit nécessaire pour la repérer.

## Scénario 5 — Accès employé restreint (FR-009, FR-010, SC-003)

1. Se connecter en tant qu'employé (selon le mécanisme d'authentification disponible au moment de l'implémentation — voir research.md §5 sur l'état du guard Employé).
2. Depuis le profil, vérifier que seuls les documents de cet employé sont visibles.
3. Tenter d'accéder à l'endpoint de téléchargement d'un document appartenant à un autre employé (ex. en modifiant un identifiant dans l'URL/requête) → doit être refusé (`403`).

## Scénario 6 — Accès DG en lecture seule (FR-011)

1. Se connecter en tant que DG.
2. Vérifier l'accès en lecture (voir/ouvrir/télécharger) aux documents des employés autorisés.
3. Vérifier l'absence de toute action d'ajout ou de suppression visible ou fonctionnelle.

## Scénario 7 — Non-régression des données Absences (FR-014, SC-005)

1. Vérifier que le modèle/table `Absence` et toute donnée existante ne sont pas supprimés par cette feature (contrôle de code + vérification base de données).

## Validation technique

Depuis `backend/` :
```bash
php artisan test
./vendor/bin/pint
```

Depuis `frontend/` :
```bash
npm run lint
npm run build
```
