#!/bin/sh
# Entrypoint du conteneur backend (Laravel). Les vraies valeurs de config
# viennent des variables d'environnement fournies par docker-compose ; ce script
# ne fait que préparer la base et lancer le serveur.
set -e

cd /var/www/html

# .env minimal si absent (les variables compose priment de toute façon).
if [ ! -f .env ]; then
  cp .env.example .env
fi

# Base SQLite : le dossier `database` est monté depuis l'hôte (données existantes).
mkdir -p database
if [ ! -f database/database.sqlite ]; then
  echo "[entrypoint] Aucune base trouvée — création d'une base vierge."
  touch database/database.sqlite
fi

# Toujours repartir d'une config fraîche.
# NE JAMAIS faire config:cache ici : cela figerait env() et casserait les
# variables fournies par compose (APP_KEY, DB_*, etc.).
php artisan config:clear || true

# Migrations — idempotent : ne fait rien si le schéma est déjà à jour.
php artisan migrate --force

echo "[entrypoint] Laravel prêt — démarrage sur 0.0.0.0:8000"
exec php artisan serve --host=0.0.0.0 --port=8000
