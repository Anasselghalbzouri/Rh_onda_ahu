# Incident : "mes changements n'apparaissent jamais sur rhahu.com"

Date : 2026-09-12
Résumé en une phrase : **le déploiement automatique (GitHub Actions) écrivait
depuis le début sur un dossier serveur qui n'était pas celui servi par
rhahu.com**, plus plusieurs bugs secondaires dans les migrations Laravel qui
auraient de toute façon fait planter le vrai déploiement une fois pointé au
bon endroit.

---

## 1. Le symptôme de départ

Un changement (`placeholder` du champ matricule dans `LoginPage.jsx`) était
commité, poussé sur `main`, le workflow GitHub Actions passait en ✅ vert...
mais le site en ligne ne changeait jamais.

---

## 2. Méthode : comment on a débuggé

Un job GitHub Actions vert ne prouve que deux choses : le code compile, et la
dernière commande de la chaîne shell a réussi. Il ne prouve pas que le
résultat a atterri au bon endroit, ni que les étapes intermédiaires ont
vraiment réussi. Il a fallu vérifier trois couches séparément :

1. **Le pipeline CI/CD** (`gh run view <id> --log`) : chaque étape a-t-elle
   fait ce qu'elle prétend ?
2. **Le serveur réel** (SSH direct avec la clé de déploiement) : qu'est-ce
   qui existe *vraiment* sur le disque, à quel endroit ?
3. **Le site public** (`curl -D -` sur l'URL) : qu'est-ce qui est *vraiment*
   servi aux visiteurs, indépendamment de ce qu'on croit avoir déployé ?

Les trois couches racontaient des histoires différentes — c'est ce qui a
révélé le vrai problème.

---

## 3. Cause racine n°1 (la vraie) : mauvais dossier de déploiement

### Ce qu'on a trouvé

Le compte Hostinger contient **deux dossiers de domaines distincts** :

```
~/domains/
├── lightgreen-woodcock-806129.hostingersite.com/   ← domaine technique
│   └── Rh_onda_ahu/backend/                        ← le secret DEPLOY_PATH pointait ICI
│
└── rhahu.com/
    ├── public_html -> Rh_onda_ahu/backend/public    ← symlink = LE VRAI document root
    └── Rh_onda_ahu/                                  ← clone git fait à la main, jamais
                                                          mis à jour depuis longtemps
```

Le secret GitHub `DEPLOY_PATH` avait été configuré (le 2026-09-05) vers le
domaine temporaire par défaut de Hostinger, et non vers `rhahu.com`. Le
CI/CD a donc rsync + migré + mis en cache un dossier que **personne ne
visite jamais**. Pendant ce temps, le vrai site tournait sur un checkout git
manuel, gelé à un vieux commit, avec sa propre base de données **MySQL**
bien remplie (129 employés, 2 responsables RH, etc. — pas du tout la
SQLite vide qu'on pensait déboguer).

### Comment on l'a confirmé (sans rien casser)

```bash
ssh -i ~/.ssh/rh_onda_deploy -p 65002 user@host "ls -la ~/domains/"
ssh ... "ls -la ~/domains/rhahu.com/public_html"   # → symlink vers backend/public
ssh ... "cd ~/domains/rhahu.com/Rh_onda_ahu && git log -1"   # → vieux commit
```

Preuve indépendante côté client, sans même se connecter au serveur :

```bash
curl -sD - https://rhahu.com/ | grep -i last-modified
# last-modified: Sat, 05 Sep 2026  ← бien avant tous les déploiements du jour
```

### La correction

Mettre à jour le secret GitHub `DEPLOY_PATH` pour qu'il pointe vers :

```
/home/<user>/domains/rhahu.com/Rh_onda_ahu/backend
```

**Leçon à retenir** : un secret de déploiement doit être vérifié en le
comparant à la config réelle du panneau d'hébergement (document root du
domaine), pas seulement supposé correct parce qu'il a été configuré une
fois. Un nom de domaine "logique" (`lightgreen-woodcock-...`) peut exister
en parallèle du vrai domaine sur le même compte.

---

## 4. Cause racine n°2 : `|| true` mal placé dans `deploy.yml`

### Le bug

```bash
php artisan migrate --force && \
php artisan storage:link || true && \
php artisan optimize:clear && ...
```

En shell, `&&` et `||` s'évaluent de gauche à droite **sans parenthèses
implicites**. Cette ligne se lit en réalité :

```
( (migrate && storage:link) || true ) && optimize:clear && ...
```

Résultat : si `migrate` échoue, `(migrate && storage:link)` est faux, mais
`faux || true` redevient vrai → le script continue comme si de rien
n'était, jusqu'à la dernière commande qui, elle, réussit → **le job GitHub
Actions est marqué succès alors que la migration a réellement planté**.

### La correction

```bash
php artisan migrate --force && \
(php artisan storage:link || true) && \
php artisan optimize:clear && ...
```

Les parenthèses limitent la portée du `|| true` à la seule commande
`storage:link` (dont l'échec est normal si le lien existe déjà).

**Leçon à retenir** : `A && B || true` ne veut jamais dire "seul B peut
échouer sans problème" — ça veut dire "toute la chaîne peut échouer sans
problème". Isoler avec des parenthèses `(B || true)` dès qu'on veut
tolérer l'échec d'une seule commande au milieu d'une chaîne `&&`.

---

## 5. Cause racine n°3 : migrations manquantes pour des tables historiques

### Le bug

Plusieurs tables (`responsable_rh`, `pieces_jointes`) n'avaient **jamais**
été créées par une migration Laravel — seulement modifiées
(`Schema::table(...)`). Elles existaient sur les environnements de
développement parce qu'elles avaient été créées à la main (import SQL
direct, ou par un outil externe), bien avant que l'équipe généralise
l'usage des migrations. Sur une base neuve, `migrate` plantait avec :

```
SQLSTATE[HY000]: no such table: responsable_rh
```

et, pour SQLite spécifiquement, un message plus cryptique quand une
migration essayait de modifier une table inexistante :

```
create table "__temp__pieces_jointes" ()
```
(SQLite ne sait pas faire d'`ALTER COLUMN` natif ; Laravel recrée la table
sous un nom temporaire en copiant ses colonnes existantes — s'il n'y a pas
de colonnes parce que la table n'existe pas, il génère une table vide,
syntaxiquement invalide.)

### La correction

Ajouter, avant les migrations existantes, des migrations de création
protégées par un garde-fou :

```php
public function up(): void
{
    if (! Schema::hasTable('responsable_rh')) {
        Schema::create('responsable_rh', function (Blueprint $table) {
            $table->id();
            $table->string('login')->unique();
        });
    }
}
```

Le `Schema::hasTable()` rend la migration **idempotente** : elle crée la
table si absente (environnement de prod neuf), et ne fait rien si elle
existe déjà (environnement où elle a été créée manuellement). Le schéma
exact a été repris via `SHOW CREATE TABLE` sur la base MySQL de référence,
plutôt que deviné à partir du code — deviner un schéma de table en
production est risqué.

**Leçon à retenir** : une migration `Schema::table(...)` (ALTER) qui n'est
jamais précédée d'une migration `Schema::create(...)` pour la même table
est un signal d'alarme — ça veut dire que la table a été créée hors du
système de migrations, ce qui casse toute installation fraîche.

---

## 6. Cause racine n°4 : nom de table inversé

### Le bug

```php
// 2026_05_21_170002_create_formation_employe_table.php
Schema::create('formation_employe', ...);   // ← créée sous CE nom

// app/Models/Employe.php et Formation.php
belongsToMany(Formation::class, 'employe_formation', ...);  // ← utilisent CET autre nom
```

Une simple inversion de nom (`formation_employe` vs `employe_formation`)
dans la migration de création. La migration suivante, qui modifie la
table par son vrai nom (`employe_formation`), échouait avec
`no such table: employe_formation`.

### La correction (en 2 temps, car déjà exécutée en prod)

1. Corriger le nom dans le fichier de création lui-même (pour toute
   nouvelle base qui n'a jamais exécuté cette migration).
2. Ajouter une **migration de rattrapage** pour les environnements où la
   version buguée a déjà tourné et créé la table sous le mauvais nom
   (Laravel ne réexécute jamais une migration déjà marquée comme faite,
   même si son contenu change) :

```php
public function up(): void
{
    if (Schema::hasTable('formation_employe') && ! Schema::hasTable('employe_formation')) {
        Schema::rename('formation_employe', 'employe_formation');
    }
}
```

**Piège rencontré en la corrigeant** : cette migration de rattrapage a
d'abord été datée *après* la migration qui en avait besoin
(`2026_05_22_000004` après `2026_05_22_000003`) → elle ne s'exécutait
jamais à temps, puisque `migrate` s'arrête à la première erreur et ne
continue pas jusqu'à une migration plus tardive qui aurait réparé la
situation. Il a fallu la re-timestamper *avant* (`2026_05_21_235959`).

**Leçon à retenir** : l'ordre d'exécution des migrations Laravel est fixé
par le **nom du fichier** (donc son timestamp), pas par sa position dans
un commit ou une pull request. Une migration de correction doit toujours
être datée avant le premier point où le problème se manifeste.

---

## 7. Chronologie condensée

| # | Symptôme observé | Cause | Fichier corrigé |
|---|---|---|---|
| 1 | Job vert, site jamais mis à jour | `DEPLOY_PATH` pointait vers le mauvais domaine Hostinger | Secret GitHub `DEPLOY_PATH` |
| 2 | Job vert malgré une vraie erreur de migration | Portée du `\|\| true` mal isolée | `.github/workflows/deploy.yml` |
| 3 | `no such table: responsable_rh` | Table jamais créée par une migration | `create_base_responsable_rh_table.php` |
| 4 | `create table "__temp__pieces_jointes" ()` | Même problème sur `pieces_jointes` | `create_base_pieces_jointes_table.php` |
| 5 | `no such table: employe_formation` | Nom de table inversé à la création | `create_formation_employe_table.php` |
| 6 | Le fix précédent ne suffisait pas en prod | Migration déjà exécutée sous le mauvais nom | migration de rename, re-timestampée |

---

## 8. Principes généraux à retenir

- **"Le job est vert" ≠ "le déploiement a fonctionné."** Toujours vérifier
  le résultat final (le site, les données), pas seulement le statut du CI.
- **`&&`/`||` en chaîne sans parenthèses piègent facilement** : isoler
  toujours la portée d'un `|| true` avec des parenthèses explicites.
- **Une table modifiée par migration doit d'abord être créée par une
  migration.** Si ce n'est pas le cas dans l'historique, c'est un signe
  qu'elle a été créée hors du système normal — corriger avec une
  migration de création protégée par `hasTable()`.
- **Une migration déjà exécutée dans un environnement ne se rejoue
  jamais**, même si son fichier change ensuite. Toute correction d'une
  migration qui a déjà tourné quelque part nécessite une migration
  *supplémentaire*, pas juste une modification du fichier existant.
- **L'ordre des migrations = ordre alphabétique du nom de fichier.** Une
  migration de correction doit être datée avant le point de défaillance
  qu'elle corrige, pas après.
- **Vérifier la config d'hébergement (document root, domaines) directement
  dans le panneau d'administration**, plutôt que de faire confiance à un
  secret configuré une fois et jamais revérifié.
