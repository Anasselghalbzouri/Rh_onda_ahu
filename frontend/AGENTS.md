# Repository Guidelines

## Project Structure & Module Organization
This repository is a monorepo with two apps:
- `backend/`: Laravel 13 (PHP 8.3) application (MVC, Blade, SQLite by default).
- `frontend/`: standalone React 19 + Vite SPA.

Frontend source code lives in `frontend/src/`, static assets in `frontend/public/`, and production output in `frontend/dist/`.
Backend routes are in `backend/routes/web.php`, controllers in `backend/app/Http/Controllers/`, tests in `backend/tests/`, and database files/migrations in `backend/database/`.

## Build, Test, and Development Commands
Run commands from each app directory.

Frontend (`frontend/`):
- `npm run dev`: start Vite dev server.
- `npm run build`: create production bundle in `dist/`.
- `npm run lint`: run ESLint checks.
- `npm run preview`: serve built output locally.

Backend (`backend/`):
- `composer run setup`: first-time install and setup.
- `composer run dev`: run server, queue, logs, and Vite concurrently.
- `composer run test`: clear config cache, then run test suite.
- `php artisan test --filter Name`: run specific tests.
- `./vendor/bin/pint`: format/lint PHP code.

## Coding Style & Naming Conventions
Use 2-space indentation for React/JS files and follow ESLint rules (`eslint.config.js`).
Use PascalCase for React components (example: `ListeEmployes.jsx`) and camelCase for variables/functions.
For Laravel, follow PSR-12 and Pint formatting. Use singular, descriptive controller names (example: `EmployeController`).

## Testing Guidelines
Backend uses PHPUnit via Laravel test runner. Place tests in `backend/tests/Feature` or `backend/tests/Unit`, and name files `*Test.php`.
Frontend currently has linting but no configured unit test framework; at minimum, run `npm run lint` before opening a PR.

## Commit & Pull Request Guidelines
Git history indicates Conventional Commit-style messages, especially `feat:` (example: `feat: implement Responsable RH authentication and dashboard`). Prefer `feat:`, `fix:`, `refactor:`, `docs:`, and keep subjects imperative and concise.

PRs should include:
- clear summary of changes and impacted area (`backend`/`frontend`),
- linked issue/task when available,
- test/lint evidence (commands run),
- UI screenshots or short recordings for frontend changes.

## Security & Configuration Tips
Do not commit `.env` files or secrets. Backend defaults to SQLite; verify local DB paths and environment settings before running migrations. Keep frontend API endpoints environment-driven when integration is added.
