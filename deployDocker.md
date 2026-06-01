# Plan de Déploiement Docker — RH Onda AHU

## Architecture

```
http://localhost
       │
       ▼
    Nginx (port 80)
       │
       ├── /          → React Frontend  (container rh_frontend)
       └── /api/...   → Laravel Backend (container rh_backend)
                                │
                                ▼
                         MySQL 8.0 (container rh_mysql)
                         base : rh_onda_ahu
                         port : 3306
```

---

## Containers Docker

| Container | Image | Rôle |
|---|---|---|
| `rh_nginx` | nginx:alpine | Reverse proxy / porte d'entrée |
| `rh_frontend` | node:20 + nginx | React 19 SPA |
| `rh_backend` | php:8.3-fpm | Laravel 13 API |
| `rh_mysql` | mysql:8.0 | Base de données |

---

## Routes API Laravel (`/api`)

### Publique (sans authentification)
| Méthode | Route | Controller | Description |
|---|---|---|---|
| POST | `/api/login` | AuthController@login | Connexion RH |

### Protégées (auth:rh requis)
| Méthode | Route | Controller | Description |
|---|---|---|---|
| POST | `/api/logout` | AuthController@logout | Déconnexion |
| GET | `/api/me` | AuthController@me | Profil connecté |
| PUT | `/api/change-password` | AuthController@changePassword | Changer mot de passe |
| POST | `/api/sync-employes` | ImportController@syncFromExcel | Import fichier Excel |
| GET | `/api/employes` | EmployeController@index | Liste des employés |
| POST | `/api/employes` | EmployeController@store | Créer un employé |
| GET | `/api/employes/{id}` | EmployeController@show | Détail un employé |
| PUT | `/api/employes/{id}` | EmployeController@update | Modifier un employé |
| DELETE | `/api/employes/{id}` | EmployeController@destroy | Supprimer un employé |
| GET | `/api/employes/{id}/pieces-jointes` | PieceJointeController@index | Liste pièces jointes |
| POST | `/api/employes/{id}/pieces-jointes` | PieceJointeController@store | Ajouter pièce jointe |
| DELETE | `/api/pieces-jointes/{id}` | PieceJointeController@destroy | Supprimer pièce jointe |

---

## Fichiers Docker créés

```
projet/
├── docker-compose.yml          ← chef d'orchestre
├── nginx/
│   └── default.conf            ← routage Nginx
├── backend/
│   ├── Dockerfile              ← PHP 8.3 + Laravel
│   ├── docker-entrypoint.sh   ← migrations auto au démarrage
│   └── .env.docker             ← variables d'environnement
└── frontend/
    └── Dockerfile              ← React build + Nginx
```

---

## Étapes de déploiement

### Première installation
```bash
# 1. Copier le .env Docker
copy backend\.env.docker backend\.env

# 2. Construire et démarrer
docker compose up -d --build

# 3. Vérifier
docker compose ps
```

### Mise à jour (nouvelle version)
```bash
git pull
docker compose up -d --build
```

### Commandes utiles
```bash
docker compose up -d        # démarrer
docker compose down         # arrêter
docker compose logs -f      # voir les logs
docker compose ps           # état des containers
```

---

## Ce qui est automatique

- MySQL démarre et charge les données (volume persistant)
- Laravel exécute `php artisan migrate` automatiquement
- Tout redémarre si le PC redémarre (`restart: always`)
- Le client ouvre juste `http://localhost` dans son navigateur

---

## À faire (TODO)

- [ ] Tester `docker compose up --build` en local
- [ ] Vérifier que les migrations passent sur MySQL
- [ ] Tester toutes les routes API via le frontend
- [ ] Configurer un domaine (ex: rh-onda.com) pour la prod
- [ ] Activer HTTPS (SSL Let's Encrypt) pour la prod
- [ ] Excel VBA — à ajouter quand demandé
