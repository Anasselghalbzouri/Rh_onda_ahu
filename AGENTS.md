# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Structure

This is a monorepo with two separate applications:

- `backend/` — Laravel 13 (PHP 8.3) API/web app using SQLite by default, with Tailwind CSS via Vite
- `frontend/` — Standalone React 19 SPA using Vite (separate from the Laravel Blade frontend)

The backend has its own Vite pipeline (`laravel-vite-plugin`) for Blade views and a `resources/js/app.js` entry. The `frontend/` directory is an independent React app that is not integrated with Laravel's asset pipeline yet.

## Backend Commands

All commands run from `backend/`:

```bash
# First-time setup
composer run setup

# Start all dev services concurrently (server, queue, logs, vite)
composer run dev

# Run tests (clears config cache first)
composer run test

# Run a single test file or filter
php artisan test --filter TestClassName
php artisan test tests/Feature/ExampleTest.php

# Lint with Laravel Pint
./vendor/bin/pint

# Database migrations
php artisan migrate
php artisan migrate:fresh --seed
```

## Frontend Commands

All commands run from `frontend/`:

```bash
npm run dev       # Vite dev server
npm run build     # Production build
npm run lint      # ESLint
npm run preview   # Preview production build
```

## Architecture Notes

**Backend:** Standard Laravel MVC structure. Routes are in `routes/web.php` (only Blade routes exist currently — no API routes file yet). Controllers live in `app/Http/Controllers/`. The default DB is SQLite (`database/database.sqlite`); tests use an in-memory SQLite DB.

**Sessions/Cache/Queue:** All configured to use the `database` driver by default (`.env.example`). Tests override these to `array`/`sync` drivers.

**Frontend (standalone):** `frontend/src/App.jsx` is the single entry point. No routing library is installed yet. The frontend has no connection to the Laravel backend at this stage.
