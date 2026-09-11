# Plan : Documents employés

## Contexte

La gestion des documents existe déjà partiellement dans `frontend/src/components/FicheEmploye/FicheEmploye.jsx` et dans l'API Laravel avec le modèle `PieceJointe` et `PieceJointeController`.

L'objectif est de compléter cette fonctionnalité et de remplacer la section d'interface **Absences** par **Documents employés**, sans supprimer immédiatement les données ou modèles backend liés aux absences.

## Fonctionnalité cible

### RH

Ajouter une page `/documents-employes` permettant de :

- consulter les documents de tous les employés ;
- rechercher par nom ou matricule ;
- filtrer par catégorie et statut ;
- ouvrir ou télécharger un document ;
- accéder à la fiche de l'employé ;
- supprimer un document avec confirmation ;
- identifier les documents manquants, expirés ou à renouveler.

### Employé

L'employé ne doit consulter que ses propres documents depuis `/profil` ou sa fiche personnelle.

### DG

Le DG peut consulter les documents autorisés en lecture seule, sans ajout ni suppression.

## Catégories proposées

- Contrat
- CIN
- Diplôme
- Attestation de travail
- Certificat médical
- Décision administrative
- Formation
- Photo
- Dossier administratif
- Autre

## Statuts proposés

- Valide
- À renouveler
- Expiré
- Manquant

Si nécessaire, ajouter à `pieces_jointes` :

- `date_expiration`
- `statut`
- `obligatoire`

## Frontend

- Retirer `absences` du menu RH et Employé dans `Sidebar.jsx`.
- Retirer la route `/absences` de `App.jsx`.
- Ajouter l'entrée `Documents employés` au menu RH.
- Créer `DocumentsEmployesPage.jsx` et son fichier CSS.
- Réutiliser les composants `Table`, `Modal`, `Badge` et `FormField`.
- Réutiliser et améliorer la logique d'upload déjà présente dans `FicheEmploye`.
- Ajouter les états de chargement, erreur, liste vide et succès.
- Ajouter recherche, filtres et pagination si le volume le justifie.
- Conserver l'accès aux documents personnels dans `FicheEmploye`.

## Backend

Compléter l'API avec les endpoints suivants :

```text
GET    /documents-employes
GET    /employes/{id}/pieces-jointes
POST   /employes/{id}/pieces-jointes
GET    /pieces-jointes/{id}/download
DELETE /pieces-jointes/{id}
```

À respecter :

- contrôler les permissions côté backend ;
- vérifier que le document appartient bien à l'employé demandé ;
- protéger le téléchargement avec Laravel ;
- ne pas exposer directement les fichiers via une URL publique ;
- valider le type MIME, l'extension et la taille ;
- limiter les noms de fichiers dangereux ;
- conserver l'utilisateur ayant ajouté ou supprimé le document ;
- utiliser une suppression logique lorsque cela correspond au modèle existant.

## Suppression d'Absences

Supprimer uniquement de l'interface dans un premier temps :

- les entrées `absences` de `Sidebar.jsx` ;
- la route `/absences` de `App.jsx` ;
- l'icône `CalendarCheck` si elle n'est plus utilisée.

Conserver temporairement le modèle `Absence`, les relations et les tables backend jusqu'à vérification des migrations, données existantes et synchronisations Excel.

## Étapes d'implémentation

1. Auditer les migrations et la structure de `pieces_jointes`.
2. Vérifier les droits RH, DG et Employé existants.
3. Ajouter les champs métier nécessaires par migration réversible.
4. Ajouter l'endpoint global des documents employés.
5. Ajouter le téléchargement sécurisé.
6. Ajouter les règles d'autorisation et de validation backend.
7. Créer la page React `DocumentsEmployesPage`.
8. Remplacer le lien Absences dans la sidebar.
9. Améliorer l'onglet Documents de `FicheEmploye`.
10. Ajouter les tests backend et frontend.
11. Vérifier le lint, le build, les tests et l'accessibilité.

## Validation

Depuis `frontend/` :

```bash
npm run lint
npm run build
```

Depuis `backend/` :

```bash
php artisan test
./vendor/bin/pint
```

Vérifier également manuellement les parcours RH, DG et Employé, ainsi que l'accès refusé à un document appartenant à un autre employé.
