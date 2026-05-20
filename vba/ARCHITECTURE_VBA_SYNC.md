# Architecture — Connexion Excel VBA ↔ Plateforme RH-ONDA

## Vue d'ensemble

Ce document explique comment le fichier Excel `.xlsm` se connecte à la plateforme RH-ONDA via deux modules VBA (`RH_Login.bas` et `RH_Sync.bas`) pour synchroniser les données des employés.

---

## Architecture globale

```
┌─────────────────────────────────────────────────────────┐
│                    EXCEL (.xlsm)                         │
│                                                          │
│  Feuille "EMPLOYES"          Feuille "RH_Config"         │
│  ┌──────────────────┐        (xlSheetVeryHidden)         │
│  │ A→Q : données    │        ┌─────────────────┐        │
│  │ R   : STATUT_SYNC│        │ B1 : Bearer token│        │
│  └──────────────────┘        │ B2 : timestamp   │        │
│                               └─────────────────┘        │
│  Module RH_Login.bas    Module RH_Sync.bas               │
└───────────┬─────────────────────┬───────────────────────┘
            │                     │
            │ POST /api/login      │ POST /api/employes/bulk-sync
            │ { matricule, pwd }   │ { employes: [...] }
            ▼                     ▼
┌─────────────────────────────────────────────────────────┐
│              Laravel API (port 8000)                     │
│                                                          │
│  AuthController::login()    EmployeController::bulkSync()│
│  → Sanctum Bearer token     → updateOrCreate par matricule│
│                             → { created, updated, errors }│
│                                                          │
│  Guard : auth:rh  (table responsable_rh)                 │
│  DB    : MySQL rh_ahu @ 127.0.0.1:3306                   │
└─────────────────────────────────────────────────────────┘
```

---

## Flux d'exécution

```
Utilisateur clique "Sync"
        │
        ▼
RH_GetToken()
   ├─ Token en B1 ? ──Yes──► retourne token
   └─ Non ──────────────────► RH_DoLogin()
                                   │
                              InputBox matricule
                              InputBox password
                                   │
                              POST /api/login
                              ◄── { token: "..." }
                                   │
                              Stocke en RH_Config!B1
                                   │
        ▼◄─────────────────────────┘
RH_SyncEmployes()
   │
   ├─ Lit feuille EMPLOYES ligne 2 → dernière ligne
   ├─ Construit JSON pour chaque ligne (colonnes A→Q)
   │    └─ NormalizeStatut() appliqué sur colonne P
   │
   ├─ POST /api/employes/bulk-sync
   │    Authorization: Bearer <token>
   │    { "employes": [ {matricule, nom, prenom, ...}, ... ] }
   │
   ├─ Réponse 200 ──► colonne R = "Sync OK dd/mm/yyyy hh:mm" (fond vert)
   ├─ Réponse 401 ──► efface token, invite à se reconnecter
   └─ Réponse 422 ──► MsgBox avec les erreurs de validation
```

---

## Mapping colonnes Excel → Champs API

| Colonne | Champ API         | Validation backend                                        |
|---------|-------------------|-----------------------------------------------------------|
| A       | `matricule`       | `required\|string`                                        |
| B       | `nom`             | `required\|string\|max:100`                               |
| C       | `prenom`          | `required\|string\|max:100`                               |
| D       | `sexe`            | `nullable\|in:M,F`                                        |
| E       | `date_naissance`  | `nullable\|date` (format ISO `yyyy-mm-dd`)                |
| F       | `date_embauche`   | `nullable\|date` (format ISO `yyyy-mm-dd`)                |
| G       | `categorie`       | `nullable\|string`                                        |
| H       | `echelle`         | `nullable\|string`                                        |
| I       | `echelon`         | `nullable\|string`                                        |
| J       | `entite`          | `nullable\|string`                                        |
| K       | `fonction`        | `nullable\|string`                                        |
| L       | `qualification`   | `nullable\|string`                                        |
| M       | `affectation`     | `nullable\|string`                                        |
| N       | `date_affectation`| `nullable\|date` (format ISO `yyyy-mm-dd`)                |
| O       | `solde_conge`     | `nullable\|numeric`                                       |
| P       | `statut`          | `nullable\|in:actif,mute,retraite,parti,suspendu`         |
| Q       | `observation`     | `nullable\|string`                                        |
| **R**   | *(STATUT_SYNC)*   | **Non envoyé à l'API — écrit par VBA après réponse**      |

> **Dates** : Les dates Excel (format serial ou `dd/mm/yyyy`) sont converties automatiquement en `yyyy-mm-dd` dans `BuildRowJson()`.

---

## Normalisation du champ Statut

Le champ `statut` (colonne P) est normalisé par `NormalizeStatut()` avant envoi pour éviter les erreurs 422 :

| Valeur Excel            | Valeur envoyée à l'API |
|-------------------------|------------------------|
| `ACTIF`, `Actif`, `active` | `actif`             |
| `MUTE`, `Muté`, `mut`   | `mute`                 |
| `RETRAITE`, `Retraité`  | `retraite`             |
| `PARTI`, `DEPART`, `Départ` | `parti`            |
| `SUSPENDU`              | `suspendu`             |
| Toute autre valeur / vide | `""` → API défaut `actif` |

---

## Format JSON envoyé à l'API

```json
{
  "employes": [
    {
      "matricule": "9519",
      "nom": "ELGHALABZOURI",
      "prenom": "Anass",
      "sexe": "M",
      "date_naissance": "1988-01-15",
      "date_embauche": "2010-06-01",
      "categorie": "A",
      "echelle": "10",
      "echelon": "3",
      "entite": "ONDA",
      "fonction": "Ingénieur",
      "qualification": "Bac+5",
      "affectation": "DSI",
      "date_affectation": "2015-01-01",
      "solde_conge": "22",
      "statut": "actif",
      "observation": ""
    }
  ]
}
```

---

## Réponse API

```json
{
  "total":   50,
  "created": 12,
  "updated": 38,
  "errors":  0,
  "results": [
    { "matricule": "9519", "status": "created" },
    { "matricule": "1234", "status": "updated" }
  ]
}
```

---

## Sécurité

| Mécanisme | Détail |
|-----------|--------|
| Authentification | Bearer token Sanctum — valide pour la session |
| Stockage token | Feuille `RH_Config` masquée (`xlSheetVeryHidden`) — non visible dans l'interface Excel |
| Expiration | Si réponse HTTP 401 → token effacé automatiquement, reconnexion demandée |
| Encodage | Toutes les requêtes sont encodées en UTF-8 via `ADODB.Stream` |
| Max lignes | L'API accepte au maximum **500 employés par envoi** |

---

## Fichiers du projet

| Fichier | Rôle |
|---------|------|
| `vba/RH_Login.bas` | Authentification API, stockage/lecture du Bearer token |
| `vba/RH_Sync.bas` | Lecture feuille Excel, construction JSON, appel bulk-sync, écriture colonne R |
| `backend/app/Http/Controllers/EmployeController.php` | Méthode `bulkSync()` — reçoit et traite les données |
| `backend/routes/api.php` | Route `POST /api/employes/bulk-sync` (protégée par `auth:rh`) |
| `backend/storage/app/public/modele_import_employes.xlsx` | Template Excel avec colonnes A→R prédéfinies |

---

## Bugs corrigés

### `RH_Login.bas`

| # | Bug | Fix |
|---|-----|-----|
| 1 | Module nommé `RH_Login` + fonction publique `RH_Login()` → conflit VBA, erreur de compilation | Renommé la fonction en `RH_DoLogin()` |
| 2 | `Friend Function Utf8Bytes` → mot-clé invalide dans un module standard `.bas`, fonction invisible depuis `RH_Sync` | Changé en `Public Function Utf8Bytes` |

### `RH_Sync.bas`

| # | Bug | Fix |
|---|-----|-----|
| 1 | Valeurs statut Excel (`ACTIF`, `Retraité`…) rejetées par l'API → erreur 422 | Ajout de `NormalizeStatut()` appliqué sur colonne P |
| 2 | `MsgBox "DEBUG"` bloquait chaque synchronisation | Ligne supprimée |
| 3 | `RH_ClearToken` appelé sans préfixe de module | Remplacé par `RH_Login.RH_ClearToken` |

---

## Installation dans Excel

1. Ouvrir le fichier `modele_import_employes.xlsx` dans Excel
2. **Fichier → Enregistrer sous** → choisir le format `.xlsm` (classeur Excel avec macros)
3. **Alt + F11** → Éditeur VBA
4. Clic droit sur le projet → **Importer un fichier**
5. Importer `RH_Login.bas` puis `RH_Sync.bas`
6. **Débogage → Compiler le projet** pour vérifier l'absence d'erreurs
7. Fermer l'éditeur VBA
8. Ajouter un bouton sur la feuille `EMPLOYES` lié à la macro `RH_SyncEmployes`

---

## Configuration

Si l'URL du serveur change, modifier `API_URL` dans les deux modules :

```vba
' RH_Login.bas  et  RH_Sync.bas
Private Const API_URL As String = "http://localhost:8000/api"
```
