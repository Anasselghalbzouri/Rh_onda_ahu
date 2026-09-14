# Research

## Excel cell typing

- **Decision**: Normalize imported values in the React XLSX adapter and explicitly type text cells in PhpSpreadsheet exports.
- **Rationale**: Excel commonly returns identifiers as numbers; explicit text typing preserves matricules and leading zeroes without changing the database schema.
- **Alternatives considered**: Relaxing Laravel validation was rejected because it weakens the API contract; changing MySQL column types is unnecessary because the existing matricule column is already text.

## Numeric and date fields

- **Decision**: Keep values transport-compatible with Laravel `numeric` and `date` validation while normalizing text fields to strings.
- **Rationale**: The API remains the single source of validation truth and existing import/export behavior is preserved.
- **Alternatives considered**: Converting every value to a database-specific SQL literal was rejected because Excel is a user-facing format, not a SQL dump.

## Validation

- **Decision**: Reuse the existing `bulk-sync` endpoint and expose the current field-level validation errors.
- **Rationale**: This avoids duplicating business rules in the frontend and keeps the workflow compatible with the current Laravel application.
- **Alternatives considered**: Adding a separate staging table was rejected as unnecessary for the current 500-row synchronous import scope.

## Synchronization confirmation

- **Decision**: Use the existing `created`, `modified`/`updated`, and `unchanged` counters returned by `bulk-sync` and render a success message in the import modal.
- **Rationale**: The backend already computes real database changes with `wasRecentlyCreated` and `wasChanged`; no extra database query is needed.
- **Alternatives considered**: Showing only “import successful” was rejected because it does not tell the administrator whether the database actually changed.
