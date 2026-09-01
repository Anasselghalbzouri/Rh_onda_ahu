# Déploiement conteneurisé — RH ONDA

Lance toute la plateforme (API Laravel + front React + base SQLite) sur n'importe
quel poste équipé de **Docker**, avec **vos données actuelles** embarquées.

## Architecture

```
        http://localhost:8080
                 │
        ┌────────▼─────────┐        proxy /api
        │  frontend (nginx)│ ───────────────────► ┌──────────────────┐
        │  React statique  │                       │ backend (Laravel)│
        └──────────────────┘                       │ php artisan serve│
                                                    │   :8000 (interne)│
                                                    └────────┬─────────┘
                                                             │ volume
                                              ./backend/database/database.sqlite
```

- **Même origine** : le front et l'API répondent sur `http://localhost:8080`
  (nginx proxifie `/api` vers le backend). Donc **pas de CORS** à gérer.
- **Base SQLite** montée depuis l'hôte : vos données voyagent avec le dossier et
  persistent entre les redémarrages.
- Le port du backend n'est **pas publié** (pas de conflit avec un
  `php artisan serve` lancé en local sur 8000).

## Prérequis

- Docker Desktop (ou Docker Engine + plugin compose).
- Rien d'autre : PHP, Composer, Node, npm sont installés **dans les images**.

## Lancer sur un autre poste

1. Copiez le dossier du projet sur la machine cible (par clé USB, réseau, etc.).
   Le fichier `backend/database/database.sqlite` et le `.env` racine (clé
   d'application) sont inclus dans la copie — c'est ce qui embarque vos données.
2. Dans le dossier :

   ```bash
   docker compose up --build
   ```

3. Ouvrez **http://localhost:8080** et connectez-vous normalement.

> Si vous partez d'un clone git (sans le `.env` racine), créez-le d'abord :
> ```bash
> cp .env.example .env
> docker compose run --rm backend php artisan key:generate --show
> # collez la valeur base64:... dans .env (APP_KEY=...)
> ```

## Commandes utiles

```bash
docker compose up --build -d      # démarrer en arrière-plan
docker compose logs -f            # voir les logs (API + front)
docker compose down               # arrêter (les données SQLite restent sur l'hôte)
docker compose exec backend php artisan migrate:status
```

## Notes

- **Données** : « Excel fait foi » côté synchro ; ici la base est votre SQLite
  existante. Pour repartir de zéro, supprimez `backend/database/database.sqlite`
  avant `up` (une base vierge sera migrée automatiquement).
- **SQLite en volume** : parfait pour un usage interne mono-serveur. Pour de la
  forte concurrence multi-instances, il faudrait passer à MySQL/Postgres
  (non requis ici).
- **File d'attente** : `QUEUE_CONNECTION=sync` — les jobs éventuels s'exécutent
  en ligne, aucun worker séparé nécessaire.
