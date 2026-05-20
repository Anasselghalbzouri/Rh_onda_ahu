# VBA — Modules de synchronisation RH-ONDA

## Fichiers

| Fichier | Tâche | Rôle |
|---|---|---|
| `RH_Login.bas` | T-062 | Connexion API, stockage Bearer token |
| `RH_Sync.bas` | T-063/064 | Lecture feuille EMPLOYES, envoi bulk-sync, écriture colonne R |

## Installation dans le classeur Excel

1. Ouvrir le classeur `.xlsm` (ou `.xlsb`) dans Excel
2. **Alt + F11** → Éditeur VBA
3. Dans l'explorateur de projet : clic droit sur le nom du classeur → **Importer un fichier**
4. Importer `RH_Login.bas` puis `RH_Sync.bas`
5. Fermer l'éditeur VBA

## Utilisation

### Connexion
```vba
' Depuis VBA ou un bouton Excel :
Call RH_Login      ' demande matricule + mot de passe, stocke le token
' ou automatiquement au premier appel de sync
```

### Synchronisation
```vba
Call RH_SyncEmployes   ' lit EMPLOYES!A2:Q*, envoie l'API, écrit colonne R
```

### Déconnexion locale
```vba
Call RH_ClearToken     ' efface le token de la feuille cachée
```

## Structure attendue de la feuille "EMPLOYES"

| Col | Champ |
|-----|-------|
| A | MATRICULE |
| B | NOM |
| C | PRENOM |
| D | SEXE (M/F) |
| E | DATE_NAISSANCE (dd/mm/yyyy) |
| F | DATE_EMBAUCHE |
| G | CATEGORIE |
| H | ECHELLE |
| I | ECHELON |
| J | ENTITE |
| K | FONCTION |
| L | QUALIFICATION |
| M | AFFECTATION |
| N | DATE_AFFECTATION |
| O | SOLDE_CONGE |
| P | STATUT |
| Q | OBSERVATION |
| **R** | **STATUT_SYNC** ← rempli automatiquement |

## Configuration

Modifier `API_URL` dans les deux modules si l'URL du serveur change :
```vba
Private Const API_URL As String = "http://localhost:8000/api"
```

## Sécurité

- Le token est stocké dans une feuille **très cachée** (`xlSheetVeryHidden`) nommée `RH_Config`
- Il n'est pas lisible depuis l'interface Excel (uniquement via VBA)
- En cas d'expiration (HTTP 401), le module efface automatiquement le token et invite à se reconnecter
