# Bibliographie — Projet RH ONDA

Recense l'ensemble des frameworks, bibliothèques, outils et standards utilisés dans ce projet.

---

## 1. Backend (Laravel / PHP)

| Référence | Version | Rôle | Source |
|-----------|---------|------|--------|
| **PHP** | 8.3 | Langage serveur | https://www.php.net/releases/8.3/ |
| **Laravel Framework** | 13.8 | Framework MVC principal | https://laravel.com/docs/13.x |
| **Laravel Sanctum** | 4.0 | Authentification API par token | https://laravel.com/docs/13.x/sanctum |
| **Laravel Tinker** | 3.0 | REPL interactif pour Artisan | https://github.com/laravel/tinker |
| **Laravel Pint** | 1.27 | Linter / formateur de code PHP | https://laravel.com/docs/13.x/pint |
| **Laravel Pail** | 1.2 | Visualiseur de logs en temps réel | https://github.com/laravel/pail |
| **Laravel Pao** | 1.0 | Outil de développement additonnel | https://github.com/laravel/pao |
| **PhpOffice/PhpSpreadsheet** | 5.7 | Import/export Excel (`.xlsx`) | https://phpspreadsheet.readthedocs.io/ |
| **FakerPHP/Faker** | 1.23 | Génération de données de test | https://fakerphp.github.io/ |
| **PHPUnit** | 12.5 | Framework de tests unitaires et fonctionnels | https://phpunit.de/ |
| **Mockery** | 1.6 | Mocking pour les tests PHP | https://docs.mockery.io/ |
| **NunoMaduro/Collision** | 8.6 | Affichage amélioré des erreurs CLI | https://github.com/nunomaduro/collision |
| **Composer** | — | Gestionnaire de dépendances PHP | https://getcomposer.org/ |
| **SQLite** | — | Base de données (développement & tests) | https://www.sqlite.org/ |

---

## 2. Frontend (React / Vite)

### Bibliothèques principales

| Référence | Version | Rôle | Source |
|-----------|---------|------|--------|
| **React** | 19.2 | Bibliothèque UI principale | https://react.dev/ |
| **React DOM** | 19.2 | Rendu DOM de React | https://react.dev/reference/react-dom |
| **React Router DOM** | 7.15 | Routage côté client (SPA) | https://reactrouter.com/en/main |
| **React Hook Form** | 7.76 | Gestion des formulaires | https://react-hook-form.com/ |
| **@hookform/resolvers** | 5.2 | Intégration Zod ↔ React Hook Form | https://github.com/react-hook-form/resolvers |
| **Zod** | 4.4 | Validation de schémas TypeScript/JS | https://zod.dev/ |
| **@tanstack/react-query** | 5.100 | Fetching et mise en cache des données serveur | https://tanstack.com/query/latest |
| **@tanstack/react-query-devtools** | 5.100 | DevTools pour React Query | https://tanstack.com/query/latest/docs/framework/react/devtools |
| **Axios** | 1.16 | Client HTTP pour les appels API | https://axios-http.com/ |
| **Recharts** | 3.8 | Graphiques et visualisations (Dashboard) | https://recharts.org/ |
| **Lucide React** | 1.16 | Bibliothèque d'icônes SVG | https://lucide.dev/ |
| **Sonner** | 2.0 | Notifications toast | https://sonner.emilkowal.ski/ |
| **@radix-ui/react-dialog** | 1.1 | Composant Modal accessible | https://www.radix-ui.com/primitives/docs/components/dialog |
| **react-error-boundary** | 6.1 | Gestion des erreurs React | https://github.com/bvaughn/react-error-boundary |
| **react-is** | 19.2 | Utilitaires d'introspection React | https://www.npmjs.com/package/react-is |

### Outils de build et de qualité

| Référence | Version | Rôle | Source |
|-----------|---------|------|--------|
| **Vite** | 8.0 | Bundler et serveur de développement | https://vite.dev/ |
| **@vitejs/plugin-react** | 6.0 | Intégration React (Fast Refresh, JSX) | https://github.com/vitejs/vite-plugin-react |
| **ESLint** | 10.3 | Linter JavaScript/JSX | https://eslint.org/ |
| **eslint-plugin-react-hooks** | 7.1 | Règles ESLint pour les Hooks React | https://www.npmjs.com/package/eslint-plugin-react-hooks |
| **eslint-plugin-jsx-a11y** | 6.10 | Règles d'accessibilité JSX | https://github.com/jsx-eslint/eslint-plugin-jsx-a11y |
| **eslint-plugin-react-refresh** | 0.5 | Support Hot Module Replacement | https://github.com/ArnaudBarre/eslint-plugin-react-refresh |
| **concurrently** | — | Exécution parallèle de scripts npm | https://github.com/open-cli-tools/concurrently |

---

## 3. Standards & Spécifications

| Référence | Description | Source |
|-----------|-------------|--------|
| **REST API** | Style architectural pour les APIs HTTP | https://restfulapi.net/ |
| **PSR-4** | Standard d'autoloading PHP (Composer) | https://www.php-fig.org/psr/psr-4/ |
| **JWT / Bearer Token** | Authentification sans état via token | RFC 7519 — https://datatracker.ietf.org/doc/html/rfc7519 |
| **WCAG 2.1** | Accessibilité Web (via eslint-plugin-jsx-a11y) | https://www.w3.org/TR/WCAG21/ |
| **OpenAPI / REST conventions** | Documentation des routes API Laravel | https://swagger.io/specification/ |

---

## 4. Architecture & Patterns

| Concept | Description | Référence |
|---------|-------------|-----------|
| **MVC (Model-View-Controller)** | Architecture Laravel (Controllers, Models, Blade) | Laravel Docs — Architecture |
| **SPA (Single Page Application)** | Architecture frontend React avec React Router | React Router Docs |
| **Monorepo** | Un seul dépôt Git pour `backend/` et `frontend/` | — |
| **Repository / Service Pattern** | Séparation logique métier dans les Controllers Laravel | Laravel Best Practices |
| **Polymorphic Relations** | Pièces jointes polymorphes (`PieceJointe`) | https://laravel.com/docs/13.x/eloquent-relationships#polymorphic-relationships |
| **Role-Based Access Control (RBAC)** | Middleware `RoleMiddleware`, enum `Role` (rh, dg, employe) | — |

---

## 5. Environnement de développement

| Outil | Rôle | Source |
|-------|------|--------|
| **Node.js** | Runtime JS (build frontend) | https://nodejs.org/ |
| **npm** | Gestionnaire de paquets JS | https://www.npmjs.com/ |
| **Git** | Contrôle de version | https://git-scm.com/ |
| **Claude Code** | Assistant IA de développement (Anthropic) | https://claude.ai/code |

---

*Bibliographie générée le 12 juin 2026 — Projet RH ONDA (Aéroports du Maroc)*
