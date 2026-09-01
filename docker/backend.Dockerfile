# Backend — API Laravel sur PHP 8.3 + SQLite
FROM php:8.3-cli

# Extensions PHP :
#   - pdo_sqlite : base de données SQLite
#   - zip        : requis par PhpSpreadsheet (import Excel)
# (dom/xml/mbstring/... sont déjà inclus dans l'image php officielle ;
#  gd n'est PAS installé — inutile ici et source d'échecs de build.)
RUN apt-get update \
    && apt-get install -y --no-install-recommends libzip-dev unzip \
    && docker-php-ext-install pdo_sqlite zip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Composer (copié depuis l'image officielle)
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# 1) Dépendances d'abord (meilleur cache Docker) — nécessite composer.json + .lock
COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --no-interaction --prefer-dist

# 2) Code source, puis autoloader optimisé (déclenche package:discover)
COPY backend/ ./
RUN composer dump-autoload --optimize --no-dev

# 3) Entrypoint — normalise d'éventuelles fins de ligne CRLF (Windows) -> LF,
#    sinon `exec /entrypoint.sh` échoue avec "no such file or directory".
COPY docker/backend-entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["/entrypoint.sh"]
