#!/bin/sh
set -e

echo ">>> Generating APP_KEY..."
php artisan key:generate --force --no-ansi

echo ">>> Caching config / routes / views..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

echo ">>> Running migrations (with retry)..."
n=0
until php artisan migrate --force --no-ansi; do
  n=$((n + 1))
  if [ "$n" -ge 12 ]; then
    echo "!!! Migration failed after $n attempts, aborting."
    exit 1
  fi
  echo "    Attempt $n failed — retrying in 5 s..."
  sleep 5
done

echo ">>> Starting PHP-FPM..."
exec php-fpm
