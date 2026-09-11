# Contract: API Documents employés

Toutes les routes sont sous `/api`, protégées par le middleware d'authentification déjà en place (`auth:rh` pour le rôle RH ; voir research.md §5 pour le statut des rôles Employé/DG). Format des réponses : JSON, cohérent avec `PieceJointeController::format()` existant.

## RH — gestion complète (User Story 1)

### `GET /documents-employes`
Liste tous les documents de tous les employés (vue globale, nouvelle route).

Query params : `q` (recherche nom/matricule employé), `categorie`, `statut` (`valide|a_renouveler|expire|manquant`), `page`.

Réponse `200` :
```json
{
  "data": [
    {
      "id": 1,
      "employe": { "id": 42, "matricule": "A123", "nom": "Doe", "prenom": "John" },
      "nom_original": "cin.pdf",
      "categorie": "CIN",
      "statut": "valide",
      "date_expiration": "2027-01-01",
      "obligatoire": true,
      "date_upload": "05/09/2026 10:00",
      "taille": "1.2 Mo"
    }
  ],
  "meta": { "total": 1, "page": 1 }
}
```
Les entrées de statut `manquant` (voir data-model.md) apparaissent aussi dans cette liste avec `id: null` et sans `date_upload`.

### `GET /employes/{id}/pieces-jointes` *(existant, étendu)*
Ajoute `date_expiration`, `statut`, `obligatoire` à la sortie déjà en place.

### `POST /employes/{id}/pieces-jointes` *(existant, étendu)*
Ajoute les champs optionnels `date_expiration`, `obligatoire` au payload multipart déjà accepté (`fichier`, `categorie`, `description`).

### `GET /pieces-jointes/{id}/download` *(nouveau)*
Retourne le fichier en flux protégé (pas d'URL publique). `404` si le document n'existe pas ou est inactif. `403` si l'utilisateur authentifié n'a pas le droit de voir ce document (RH : toujours autorisé ; Employé : uniquement si `entite_id` correspond à son propre employé ; DG : selon son périmètre).

### `DELETE /pieces-jointes/{id}` *(existant, comportement inchangé)*
Suppression logique (`actif=false`), enregistre `supprime_par`.

## Employé — lecture seule de ses propres documents (User Story 2)

### `GET /moi/pieces-jointes` *(nouveau)*
Équivalent de `GET /employes/{id}/pieces-jointes` mais `{id}` est résolu automatiquement à partir de l'utilisateur authentifié, jamais transmis par le client — empêche toute tentative d'accès aux documents d'un autre employé par manipulation d'identifiant (FR-010).

### `GET /pieces-jointes/{id}/download`
Même route que RH ; l'autorisation `403` s'applique si le document n'appartient pas à l'employé courant.

Aucun accès à `POST`/`DELETE` pour ce rôle.

## DG — lecture seule (User Story 3)

Réutilise `GET /documents-employes` et `GET /pieces-jointes/{id}/download` avec un périmètre en lecture seule (aucune exposition d'action d'ajout/suppression côté frontend ; le contrôleur backend refuse `POST`/`DELETE` pour ce rôle une fois le guard DG disponible — voir research.md §5).

## Codes d'erreur communs

| Code | Cas |
|---|---|
| `401` | Non authentifié |
| `403` | Authentifié mais non autorisé pour cette ressource (ex. employé consultant un document qui n'est pas le sien) |
| `404` | Employé ou document introuvable / inactif |
| `422` | Fichier invalide (type, taille) ou champs de validation incorrects |
