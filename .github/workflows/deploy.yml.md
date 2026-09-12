# `deploy.yml` — explication ligne par ligne

Workflow GitHub Actions qui déploie l'app (backend Laravel + frontend React)
sur Hostinger via SSH/rsync à chaque push sur `main`.

```yaml
name: Deploy to Hostinger
```
Nom du workflow, affiché dans l'onglet **Actions** de GitHub.

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
```
Déclencheurs : automatique à chaque `push` sur `main`, ou manuel via le
bouton "Run workflow" dans l'onglet Actions (`workflow_dispatch`).

```yaml
concurrency:
  group: deploy-production
  cancel-in-progress: false
```
Regroupe les exécutions sous la clé `deploy-production` : si un déploiement
est déjà en cours, un nouveau push met le suivant en **file d'attente**
(il ne l'annule pas — `cancel-in-progress: false`) pour éviter que deux
déploiements écrivent en même temps sur le même serveur.

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
```
Un seul job, `deploy`, exécuté sur une machine virtuelle Ubuntu fournie par
GitHub.

```yaml
    steps:
      # 1) Récupère le code source
      - uses: actions/checkout@v4
```
Étape 1 : clone le dépôt (commit qui a déclenché le workflow) dans le
répertoire de travail du runner.

```yaml
      # 2) Compile les dépendances PHP de production (comme composer install --no-dev)
      - uses: shivammathur/setup-php@v2
        with:
          php-version: '8.4'
          extensions: pdo_sqlite, zip, mbstring
          tools: composer:v2
```
Étape 2 : installe PHP 8.4 sur le runner avec les extensions nécessaires à
Laravel/SQLite (`pdo_sqlite`, `zip`, `mbstring`) et l'outil `composer` v2.

```yaml
      - name: Composer install (prod)
        working-directory: backend
        run: composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist
```
Installe les dépendances PHP du dossier `backend/` en mode production
(`--no-dev` exclut les paquets de dev, `--optimize-autoloader` accélère
l'autoload, `--no-interaction` évite tout prompt bloquant).

```yaml
      # 3) Compile le frontend React (Vite) puis le copie dans backend/public
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
```
Étape 3 : installe Node.js 22 sur le runner, nécessaire pour builder le
frontend React/Vite.

```yaml
      - name: Build frontend
        working-directory: frontend
        run: |
          npm install
          npm run build
```
Installe les dépendances npm du dossier `frontend/`, puis lance le build
Vite (`npm run build`), qui génère les fichiers statiques compilés dans
`frontend/build/`.

```yaml
      - name: Copie du SPA compilé dans backend/public
        run: cp -r frontend/build/. backend/public/
```
Copie récursivement le résultat du build React dans `backend/public/`, pour
que Laravel serve directement les fichiers du SPA (le tout part ensuite
comme un seul bloc via rsync).

```yaml
      # 4) Prépare la clé SSH pour joindre Hostinger
      - name: Configuration SSH
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.SSH_PRIVATE_KEY }}" > ~/.ssh/id_deploy
          chmod 600 ~/.ssh/id_deploy
          ssh-keyscan -p ${{ secrets.SSH_PORT }} -H ${{ secrets.SSH_HOST }} >> ~/.ssh/known_hosts 2>/dev/null
```
Étape 4 : crée le dossier `~/.ssh`, écrit la clé privée (stockée dans le
secret GitHub `SSH_PRIVATE_KEY`) dans un fichier `id_deploy`, restreint ses
permissions à `600` (obligatoire pour que SSH accepte de l'utiliser), puis
enregistre l'empreinte du serveur Hostinger dans `known_hosts` via
`ssh-keyscan` (évite le prompt interactif "authenticity of host... can't be
established").

```yaml
      # 5) Crée le dossier de déploiement (et ses parents) s'il n'existe pas
      #    encore. rsync ne peut créer qu'un seul niveau de dossier manquant ;
      #    sur un hébergement neuf, aucun des deux niveaux n'existe encore,
      #    d'où l'échec "mkdir failed: No such file or directory" observé.
      #    mkdir -p est idempotent : sans effet si le dossier existe déjà.
      - name: Création du dossier de déploiement (si absent)
        run: |
          ssh -i ~/.ssh/id_deploy -p ${{ secrets.SSH_PORT }} \
            ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} \
            "mkdir -p '${{ secrets.DEPLOY_PATH }}'"
```
Étape 5 : se connecte en SSH au serveur (avec la clé, le port, l'utilisateur
et l'hôte issus des secrets) et crée le dossier cible `DEPLOY_PATH` (et ses
parents) s'il n'existe pas encore — nécessaire sur un serveur neuf, sinon
`rsync` échouerait car il ne peut créer qu'un seul niveau de dossier
manquant. `mkdir -p` ne fait rien si le dossier existe déjà (idempotent).

```yaml
      # 6) storage/ est volontairement exclu du rsync (pour ne jamais écraser
      #    logs/uploads/sessions existants) — mais sur un serveur neuf, cette
      #    arborescence n'a donc jamais été créée du tout. Laravel exige que
      #    ces dossiers existent (ex. storage/framework/views, requis par
      #    `php artisan view:cache`). mkdir -p est idempotent : sans effet une
      #    fois ces dossiers déjà présents lors des déploiements suivants.
      - name: Provisionnement de storage/ (si absent)
        run: |
          ssh -i ~/.ssh/id_deploy -p ${{ secrets.SSH_PORT }} \
            ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} \
            "mkdir -p '${{ secrets.DEPLOY_PATH }}/storage/app/public' \
                      '${{ secrets.DEPLOY_PATH }}/storage/framework/cache/data' \
                      '${{ secrets.DEPLOY_PATH }}/storage/framework/sessions' \
                      '${{ secrets.DEPLOY_PATH }}/storage/framework/testing' \
                      '${{ secrets.DEPLOY_PATH }}/storage/framework/views' \
                      '${{ secrets.DEPLOY_PATH }}/storage/logs' && \
             chmod -R 775 '${{ secrets.DEPLOY_PATH }}/storage'"
```
Étape 6 : crée à la main les sous-dossiers de `storage/` requis par Laravel
(cache, sessions, tests, vues compilées, logs). Nécessaire parce que
`storage/` est exclu du rsync (étape 7) pour ne jamais écraser les
logs/uploads/sessions déjà présents sur le serveur — donc sur un serveur
neuf cette arborescence ne serait jamais créée sinon. `chmod -R 775` donne
les droits d'écriture nécessaires au serveur web (PHP-FPM) sur ces dossiers.

```yaml
      # 7) Envoie SEULEMENT le code vers le serveur.
      #    Exclusions critiques : la base SQLite en production, le .env du
      #    serveur (contient l'APP_KEY stable) et storage/ (uploads, sessions,
      #    logs) ne sont JAMAIS écrasés. --delete nettoie le vieux code mais
      #    respecte ces exclusions.
      - name: Déploiement via rsync
        run: |
          rsync -az --delete \
            -e "ssh -i ~/.ssh/id_deploy -p ${{ secrets.SSH_PORT }}" \
            --exclude='.env' \
            --exclude='.git' \
            --exclude='storage/' \
            --exclude='public/storage' \
            --exclude='database/*.sqlite' \
            --exclude='database/*.sqlite-journal' \
            backend/ \
            ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:${{ secrets.DEPLOY_PATH }}/
```
Étape 7, le cœur du déploiement : synchronise le dossier `backend/` (code +
build frontend copié dedans) vers `DEPLOY_PATH` sur le serveur via `rsync`.
- `-a` : mode archive (préserve permissions, dates, liens, récursif).
- `-z` : compresse les données pendant le transfert.
- `--delete` : supprime côté serveur les fichiers qui n'existent plus dans
  `backend/` (garde le serveur en miroir exact du dépôt), **sauf** ce qui
  est explicitement exclu ci-dessous.
- `-e "ssh -i ... -p ..."` : indique à rsync d'utiliser SSH avec la clé et
  le port du déploiement.
- `--exclude='.env'` : ne jamais écraser le `.env` de production (contient
  l'`APP_KEY` stable et les vrais identifiants de prod).
- `--exclude='.git'` : n'envoie pas l'historique git.
- `--exclude='storage/'` et `--exclude='public/storage'` : préserve les
  fichiers déjà présents sur le serveur (uploads, logs, sessions, lien
  symbolique de stockage public).
- `--exclude='database/*.sqlite*'` : ne touche jamais à la base de données
  SQLite de production ni à son journal.

```yaml
      # 8) Applique les migrations et recache la config, côté serveur.
      #    migrate --force ne touche qu'au SCHÉMA, jamais aux données.
      #    On vide d'abord les caches existants (config/route/view) avant de
      #    les reconstruire : sans ce clear, `*:cache` peut recacher par-dessus
      #    un ancien cache (ex. routes) et le site continue de servir du stale.
      - name: Migrations + cache (sur le serveur)
        run: |
          ssh -i ~/.ssh/id_deploy -p ${{ secrets.SSH_PORT }} \
            ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} \
            "cd ${{ secrets.DEPLOY_PATH }} && \
             php artisan migrate --force && \
             (php artisan storage:link || true) && \
             php artisan optimize:clear && \
             php artisan config:cache && \
             php artisan route:cache && \
             php artisan view:cache"
```
Étape 8, dernière étape, exécutée directement sur le serveur via SSH :
- `cd DEPLOY_PATH` : se place dans le dossier déployé.
- `php artisan migrate --force` : applique les migrations de base de
  données. `--force` autorise l'exécution en environnement de production
  sans confirmation interactive. Ne touche qu'au **schéma**, jamais aux
  données existantes. Si cette commande échoue, `&&` stoppe la chaîne :
  le reste (cache, etc.) ne s'exécute pas et le job remonte en échec.
- `(php artisan storage:link || true)` : recrée le lien symbolique
  `public/storage` → `storage/app/public` s'il n'existe pas déjà ; le
  `|| true` évite de faire échouer le déploiement si le lien existe déjà
  (la commande renverrait une erreur sinon). Les parenthèses limitent la
  portée du `|| true` à **cette seule commande** — sans elles,
  `migrate && storage:link || true` se lit comme
  `(migrate && storage:link) || true`, ce qui masque aussi un échec de
  `migrate` et laisse le job continuer (et réussir en vert) même si les
  migrations ont échoué. C'est le bug qui s'est produit en pratique
  (`no such table: responsable_rh`) : le job était marqué succès alors que
  la migration avait réellement échoué.
- `php artisan optimize:clear` : vide tous les caches existants (config,
  routes, vues, events, compiled classes) **avant** de les reconstruire —
  évite que les commandes `*:cache` suivantes recachent par-dessus un
  ancien cache déjà présent sur le serveur, ce qui ferait continuer à
  servir une version périmée (stale) du site après déploiement.
- `php artisan config:cache` : recompile la configuration Laravel en un
  seul fichier pour de meilleures performances.
- `php artisan route:cache` : recompile les routes en cache.
- `php artisan view:cache` : précompile les vues Blade.
