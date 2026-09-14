# Quickstart Validation

## Prerequisites

- Backend dependencies installed and database migrated.
- Frontend dependencies installed.
- API and frontend configured for the same environment.

## Validate import

1. Open Personnel and download the Excel model.
2. Enter at least one employee, including a matricule such as `000123`.
3. Save and import the workbook.
4. Confirm the request succeeds and the employee appears with the exact matricule.
5. Repeat with numeric-looking values in optional fields and confirm no `must be a string` errors are shown.

### Cell typing scenarios

- **Numeric-looking identifier**: enter `000123` in a text-formatted `Matricule`
  cell; after import the matricule is `000123` (leading zeroes preserved).
- **Excel date cell**: enter a real date (not text) in `Date embauche`; the
  adapter converts it to `YYYY-MM-DD` and the import succeeds without a date
  validation error.
- **Serial/date text**: enter `15/01/2020` (or `15-01-2020`) in a date column;
  it is normalized to `2020-01-15`.
- **Numeric balance**: enter `12` in `Solde congé (j)`; import succeeds and the
  balance is `12`.
- **Blank optional cells**: leave `Sexe`, `Observation`, etc. empty; the import
  succeeds and no `must be a string` error is raised.
- **Invalid value**: enter an invalid value (for example `X` in `Sexe`); the
  error message names the affected row and field (for example
  `Ligne 2 · sexe`).

## Validate export and round trip

1. Export the employee list from Personnel.
2. Open the workbook in Excel and confirm text identifiers retain leading zeroes
   and the header row matches the import template order.
3. Confirm `Solde congé (j)` opens as a numeric cell.
4. Import the exported workbook without editing headers.
5. Confirm rows are reported as unchanged when no data was modified.

## Automated checks

```powershell
Set-Location frontend
npm run build

Set-Location ..\backend
php -l app/Exports/EmployeExport.php
php artisan test
```

Expected result: frontend build and PHP syntax checks pass; backend tests pass or report only pre-existing failures.

## Validate confirmation message

1. Import a workbook containing a new employee and confirm the message reports created rows.
2. Edit an existing employee and import again; confirm the message reports modified rows.
3. Import the same workbook a second time; confirm the message says that no database change occurred and reports unchanged rows.

## Recorded automated results (2026-09-14)

- Backend: `php artisan test` → 6 passed, 26 assertions (includes the 4 `EmployeExcelTest` cases).
- Backend: `php -l app/Exports/EmployeExport.php` → no syntax errors.
- Backend: `php vendor/bin/pint --test` (feature files) → passed.
- Frontend: `npm test` → 7 passed (`ImportExcelModal` created/modified/unchanged/failed interactions and `buildSyncConfirmation`).
- Frontend: `npm run build` → passed. Pre-existing warning: bundle chunk > 500 kB.
- Frontend: `npx eslint` (feature files) → clean. The build output is now ignored by ESLint (`build`, `coverage`), and JSX identifiers are marked as used (`react/jsx-uses-vars`). A pre-existing, feature-unrelated baseline of 7 errors remains in other components (`react-hooks/set-state-in-effect`, `jsx-a11y/label-has-associated-control`, one unused import in `Layout.jsx`).

No feature-related failures remain.
