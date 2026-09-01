# RH ONDA AHU API Documentation

Last updated: 2026-05-26

## Overview

The backend exposes a JSON REST API for RH ONDA AHU human resources workflows: authentication, employees, leave requests, attachments, training plans, training sessions, registrations, evaluations, courses, and dashboard statistics.

Base URL for local development:

```text
http://localhost:8000/api
```

The standalone React frontend is configured to call this base URL in `frontend/src/api.js`.

## Authentication

The API uses Laravel Sanctum bearer tokens with the custom `rh` guard. Only `POST /login` is public. Every other endpoint requires:

```http
Authorization: Bearer <token>
Accept: application/json
```

Common authentication errors:

| Status | Meaning |
| --- | --- |
| `401 Unauthorized` | Missing, invalid, or expired bearer token. |
| `422 Unprocessable Content` | Validation failed, including invalid login credentials. |

### Login

Authenticates an RH user by matricule and password.

```http
POST /login
```

Request body:

```json
{
  "matricule": "RH001",
  "password": "secret"
}
```

Success response `200 OK`:

```json
{
  "token": "1|plain-text-sanctum-token",
  "user": {
    "id": 1,
    "matricule": "RH001",
    "prenom": "Sara",
    "nom": "Alami",
    "role": "rh"
  }
}
```

Example:

```bash
curl -X POST http://localhost:8000/api/login \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"matricule":"RH001","password":"secret"}'
```

### Logout

Deletes the current access token.

```http
POST /logout
```

Success response `200 OK`:

```json
{
  "message": "Deconnexion reussie."
}
```

### Current User

Returns the authenticated RH profile.

```http
GET /me
```

Success response `200 OK`:

```json
{
  "id": 1,
  "matricule": "RH001",
  "prenom": "Sara",
  "nom": "Alami",
  "role": "rh"
}
```

### Change Password

```http
PUT /change-password
```

Request body:

```json
{
  "current_password": "old-password",
  "password": "new-password",
  "password_confirmation": "new-password"
}
```

Validation:

| Field | Rules |
| --- | --- |
| `current_password` | required string |
| `password` | required string, minimum 4 characters, must be confirmed |
| `password_confirmation` | required string |

Success response `200 OK`:

```json
{
  "message": "Mot de passe mis a jour avec succes."
}
```

## Common Response Formats

Laravel validation errors use the default `422` JSON shape:

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "field": [
      "The field is required."
    ]
  }
}
```

Paginated list endpoints return Laravel paginator data:

```json
{
  "current_page": 1,
  "data": [],
  "first_page_url": "http://localhost:8000/api/employes?page=1",
  "from": null,
  "last_page": 1,
  "last_page_url": "http://localhost:8000/api/employes?page=1",
  "links": [],
  "next_page_url": null,
  "path": "http://localhost:8000/api/employes",
  "per_page": 15,
  "prev_page_url": null,
  "to": null,
  "total": 0
}
```

Common resource errors:

| Status | Meaning |
| --- | --- |
| `404 Not Found` | Resource ID does not exist. |
| `422 Unprocessable Content` | Request body or query parameters failed validation. |
| `204 No Content` | Delete completed successfully and no body is returned. |

## Reference Data

### List Services

```http
GET /services
```

Returns services ordered by name.

Success response `200 OK`:

```json
[
  {
    "id": 1,
    "nom": "Ressources Humaines"
  }
]
```

## Employees

Employee status values used by create and bulk sync:

```text
actif, mute, retraite, parti, suspendu
```

### List Employees

```http
GET /employes
```

Query parameters:

| Name | Type | Description |
| --- | --- | --- |
| `search` | string | Matches `nom`, `prenom`, `matricule`, or `fonction`. |
| `statut` | string | Filters by employee status. |
| `service_id` | integer | Filters by service ID. |
| `per_page` | integer | Page size. Defaults to `15`, maximum `200`. |
| `page` | integer | Page number. |

Success response `200 OK`: paginated employees with `service` relation.

Example:

```bash
curl "http://localhost:8000/api/employes?search=ali&per_page=20" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json"
```

### Create Employee

```http
POST /employes
```

Request body:

```json
{
  "matricule": "EMP001",
  "nom": "Alami",
  "prenom": "Sara",
  "sexe": "F",
  "date_naissance": "1990-04-15",
  "date_embauche": "2015-09-01",
  "categorie": "Cadre",
  "echelle": "11",
  "echelon": "3",
  "entite": "ONDA",
  "fonction": "Responsable RH",
  "qualification": "Master RH",
  "service_id": 1,
  "affectation": "Casablanca",
  "date_affectation": "2020-01-01",
  "solde_conge": 18,
  "statut": "actif",
  "observation": "Aucune"
}
```

Required fields: `matricule`, `nom`, `prenom`, `sexe`.

Validation highlights:

| Field | Rules |
| --- | --- |
| `matricule` | required, string, unique in `employe.matricule` |
| `nom`, `prenom` | required, string, max 100 |
| `sexe` | required, one of `M`, `F` |
| date fields | nullable date |
| `service_id` | nullable integer, must exist in `service.id` |
| `solde_conge` | nullable numeric, minimum 0 |
| `statut` | nullable, one of `actif`, `mute`, `retraite`, `parti`, `suspendu`; defaults to `actif` |

Success response `201 Created`: created employee object.

### Get Employee

```http
GET /employes/{id}
```

`id` may be either the numeric employee ID or a `matricule`.

Success response `200 OK`: employee with `service`, `dossier_personnel`, `historique_professionnel`, and recent `demandes_conge`.

### Update Employee

```http
PUT /employes/{id}
```

Accepts the same employee fields as create, but all fields are optional. `matricule` must remain unique.

Success response `200 OK`: updated employee object.

### Delete Employee

```http
DELETE /employes/{id}
```

Success response `200 OK`:

```json
{
  "message": "Employe supprime."
}
```

### Bulk Sync Employees

Upserts up to 500 employees from external sources such as Excel/VBA.

```http
POST /employes/bulk-sync
```

Request body:

```json
{
  "employes": [
    {
      "matricule": "EMP001",
      "nom": "Alami",
      "prenom": "Sara",
      "sexe": "F",
      "fonction": "Responsable RH",
      "solde_conge": 18,
      "statut": "actif"
    }
  ]
}
```

Validation:

| Field | Rules |
| --- | --- |
| `employes` | required array, 1 to 500 items |
| `employes.*.matricule` | required string |
| `employes.*.nom`, `employes.*.prenom` | required string, max 100 |
| other employee fields | same general rules as employee create |

Success response `200 OK`:

```json
{
  "total": 1,
  "created": 1,
  "updated": 0,
  "errors": 0,
  "results": [
    {
      "matricule": "EMP001",
      "status": "created"
    }
  ]
}
```

## Leave Requests

Leave type values:

```text
annuel, maladie, maternite, sans_solde, exceptionnel
```

The current implementation treats direct leave entry as already approved. Creating a leave request sets `statut` to `approuve` and deducts `nombre_jours` from the employee leave balance. Deleting a leave request credits the days back.

### List Leave Requests

```http
GET /conges
```

Query parameters:

| Name | Type | Description |
| --- | --- | --- |
| `employe_id` | integer | Filters by employee. |
| `type_conge` | string | Filters by leave type. |
| `statut` | string | Filters by status. |
| `page` | integer | Page number. |

Success response `200 OK`: paginated leave requests with employee summary.

### Create Leave Request

```http
POST /conges
Content-Type: multipart/form-data
```

Form fields:

| Field | Rules |
| --- | --- |
| `employe_id` | required integer, must exist in `employe.id` |
| `type_conge` | required, one of `annuel`, `maladie`, `maternite`, `sans_solde`, `exceptionnel` |
| `date_debut` | required date |
| `date_fin` | required date, after or equal to `date_debut` |
| `nombre_jours` | optional integer, minimum 1. If omitted, it is calculated inclusively from dates. |
| `motif` | optional string, max 1000 |
| `ref_hraccess` | optional string, max 100 |
| `ref_onda_ahu` | optional string, max 100 |
| `fichier` | optional file, PDF/JPG/JPEG/PNG/DOC/DOCX, max 10 MB |

Example:

```bash
curl -X POST http://localhost:8000/api/conges \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json" \
  -F "employe_id=1" \
  -F "type_conge=annuel" \
  -F "date_debut=2026-06-01" \
  -F "date_fin=2026-06-05" \
  -F "motif=Conge annuel"
```

Success response `201 Created`: leave request with employee summary.

### Get Leave Request

```http
GET /conges/{id}
```

Success response `200 OK`: leave request with employee summary.

### Update Leave Request

```http
PUT /conges/{id}
Content-Type: multipart/form-data
```

Accepted fields: `type_conge`, `date_debut`, `date_fin`, `nombre_jours`, `motif`, `ref_hraccess`, `ref_onda_ahu`, `fichier`.

Changing dates or `nombre_jours` recalculates the employee balance by applying the difference from the old number of days.

Success response `200 OK`: updated leave request with employee summary.

### Delete Leave Request

```http
DELETE /conges/{id}
```

Success response `200 OK`:

```json
{
  "message": "Conge supprime, solde recredite."
}
```

### Download Leave Attachment

```http
GET /conges/{id}/fichier
```

Success response `200 OK`: binary file download.

Error response `404 Not Found`:

```json
{
  "message": "Aucun fichier attache."
}
```

## Employee Attachments

Attachment uploads are stored on the Laravel `public` disk and are soft-deleted by setting `actif` to false.

### List Employee Attachments

```http
GET /employes/{id}/pieces-jointes
```

Success response `200 OK`:

```json
[
  {
    "id": 1,
    "nom_original": "cin.pdf",
    "extension": "pdf",
    "taille": "120.4 Ko",
    "categorie": "Identite",
    "description": "Copie CIN",
    "date_upload": "26/05/2026 14:30",
    "url": "/storage/pieces_jointes/1/cin.pdf"
  }
]
```

### Upload Employee Attachment

```http
POST /employes/{id}/pieces-jointes
Content-Type: multipart/form-data
```

Form fields:

| Field | Rules |
| --- | --- |
| `fichier` | required file, PDF/JPG/JPEG/PNG/DOC/DOCX, max 5 MB |
| `categorie` | optional string, max 100 |
| `description` | optional string, max 255 |

Success response `201 Created`: formatted attachment object.

### Delete Attachment

```http
DELETE /pieces-jointes/{id}
```

Success response `200 OK`:

```json
{
  "message": "Piece jointe supprimee."
}
```

## Training Plans

Plan status values differ slightly between create and update validation in the current code:

| Operation | Accepted status values |
| --- | --- |
| Create | `draft`, `valide`, `archive` |
| Update | `draft`, `valide`, `clos` |

Only plans with `statut = draft` can be deleted.

### List Training Plans

```http
GET /plans-formation
```

Query parameters:

| Name | Type | Description |
| --- | --- | --- |
| `annee` | integer | Filters by year. |
| `statut` | string | Filters by status. |
| `page` | integer | Page number. |

Success response `200 OK`: paginated plans with `formations_count`.

### Create Training Plan

```http
POST /plans-formation
```

Request body:

```json
{
  "annee": 2026,
  "titre": "Plan de formation 2026",
  "description": "Plan annuel",
  "statut": "draft"
}
```

Validation:

| Field | Rules |
| --- | --- |
| `annee` | required integer, 2000 to 2100 |
| `titre` | required string, max 200 |
| `description` | optional string |
| `statut` | optional string, one of `draft`, `valide`, `archive` |

Success response `201 Created`: created plan.

### Get Training Plan

```http
GET /plans-formation/{id}
```

Success response `200 OK`: plan with `formations_count` and formations ordered by `date_debut`.

### Update Training Plan

```http
PUT /plans-formation/{id}
```

Accepted fields: `annee`, `titre`, `description`, `statut`.

Success response `200 OK`: updated plan.

### Delete Training Plan

```http
DELETE /plans-formation/{id}
```

Success response `204 No Content`.

If the plan is not in draft:

```json
{
  "message": "Seul un plan en statut draft peut etre supprime."
}
```

## Formations

### List Formations

```http
GET /formations
```

Query parameters:

| Name | Type | Description |
| --- | --- | --- |
| `plan_id` | integer | Filters by training plan. |
| `type` | string | Filters by type. |
| `annee` | integer | Filters by year of `date_debut`. |
| `service_id` | integer | Filters formations by employees attached to a service. |
| `page` | integer | Page number. |

Success response `200 OK`: paginated formations with `planFormation` summary and `employes_count`.

### Create Formation

```http
POST /formations
```

Request body:

```json
{
  "plan_formation_id": 1,
  "cours_id": 2,
  "intitule": "Management d'equipe",
  "type": "interne",
  "organisme": "ONDA Academy",
  "date_debut": "2026-07-01",
  "date_fin": "2026-07-03",
  "lieu": "Casablanca",
  "niveau": "avance",
  "observations": "Session prioritaire"
}
```

Validation:

| Field | Rules |
| --- | --- |
| `plan_formation_id` | optional, must exist in `plan_formation.id` |
| `cours_id` | optional, must exist in `cours.id` |
| `intitule` | required string, max 200 |
| `type` | optional string |
| `organisme` | optional string, max 200 |
| `date_debut` | required date |
| `date_fin` | required date, after or equal to `date_debut` |
| `lieu` | optional string, max 200 |
| `niveau` | optional string |
| `observations` | optional string |

Success response `201 Created`: created formation with plan summary.

### Export Formations

```http
GET /formations/export
```

Success response `200 OK`: streamed export download generated by `FormationExport`.

### Bulk Sync Formations

```http
POST /formations/bulk-sync
```

Request body:

```json
{
  "formations": [
    {
      "intitule": "Management d'equipe",
      "organisme": "ONDA Academy",
      "duree_jours": 3,
      "mois_prevu": 7,
      "observations": "Session prioritaire"
    }
  ]
}
```

Validation:

| Field | Rules |
| --- | --- |
| `formations` | required array |
| `formations.*.intitule` | required string |
| `formations.*.organisme` | optional string |
| `formations.*.duree_jours` | optional integer, minimum 1 |
| `formations.*.mois_prevu` | optional integer, 1 to 12 |
| `formations.*.observations` | optional string |

Success response `200 OK`:

```json
{
  "synced": 1
}
```

### Get Formation

```http
GET /formations/{id}
```

Success response `200 OK`: formation with plan summary, employees, evaluations, and `employes_count`.

### Update Formation

```http
PUT /formations/{id}
```

Accepted fields: `plan_formation_id`, `cours_id`, `intitule`, `type`, `organisme`, `date_debut`, `date_fin`, `lieu`, `niveau`, `mois_prevu`, `observations`.

Success response `200 OK`: updated formation with plan summary.

### Delete Formation

```http
DELETE /formations/{id}
```

Success response `204 No Content`.

## Formation Registrations

Registration status values:

```text
inscrit, present, absent, certifie
```

### Register Employee for Formation

```http
POST /formations/{id}/employes
```

Request body:

```json
{
  "employe_id": 1,
  "statut": "inscrit"
}
```

Validation:

| Field | Rules |
| --- | --- |
| `employe_id` | required, must exist in `employe.id` |
| `statut` | optional, one of `inscrit`, `present`, `absent`, `certifie`; defaults to `inscrit` |

Success response `201 Created`:

```json
{
  "message": "Employe inscrit."
}
```

### Update Formation Registration

```http
PUT /formations/{id}/employes/{eid}
```

Request body:

```json
{
  "statut": "present",
  "suivi": true,
  "remarque": "Presence confirmee"
}
```

Validation:

| Field | Rules |
| --- | --- |
| `statut` | required, one of `inscrit`, `present`, `absent`, `certifie` |
| `suivi` | optional boolean |
| `remarque` | optional nullable string |

Success response `200 OK`:

```json
{
  "message": "Statut mis a jour."
}
```

### Unregister Employee from Formation

```http
DELETE /formations/{id}/employes/{eid}
```

Success response `204 No Content`.

### List Employee Formations

```http
GET /employes/{id}/formations
```

Success response `200 OK`: array of formations for the employee, ordered by newest `date_debut`.

## Formation Evaluations

Evaluation type values:

```text
chaud, froid
```

### List Formation Evaluations

```http
GET /formations/{id}/evaluations
```

Success response `200 OK`: array of evaluations with employee summary.

### Create Formation Evaluation

```http
POST /formations/{id}/evaluations
```

Request body:

```json
{
  "employe_id": 1,
  "type": "chaud",
  "note": 16,
  "commentaire": "Formation utile",
  "efficace": true,
  "date_eval": "2026-07-04"
}
```

Validation:

| Field | Rules |
| --- | --- |
| `employe_id` | required, must exist in `employe.id` |
| `type` | optional, one of `chaud`, `froid` |
| `note` | optional integer, 0 to 20 |
| `commentaire` | optional string |
| `efficace` | optional boolean |
| `date_eval` | required date |

Success response `201 Created`: evaluation with employee summary.

### Update Formation Evaluation

```http
PUT /evaluations/{id}
```

Accepted fields: `type`, `note`, `commentaire`, `efficace`, `date_eval`.

Success response `200 OK`: updated evaluation with employee summary.

### Delete Formation Evaluation

```http
DELETE /evaluations/{id}
```

Success response `204 No Content`.

## Courses

### List Courses

```http
GET /cours
```

Success response `200 OK`: array of courses ordered by `theme`.

### Create Course

```http
POST /cours
```

Request body:

```json
{
  "theme": "Management",
  "description": "Techniques de management",
  "duree_jours": 3
}
```

Validation:

| Field | Rules |
| --- | --- |
| `theme` | required string, max 255 |
| `description` | optional string |
| `duree_jours` | optional integer, 1 to 365 |

Success response `201 Created`: created course.

### Get Course

```http
GET /cours/{id}
```

Success response `200 OK`: course object.

### Update Course

```http
PUT /cours/{id}
```

Accepted fields: `theme`, `description`, `duree_jours`.

Success response `200 OK`: updated course.

### Delete Course

```http
DELETE /cours/{id}
```

Success response `204 No Content`.

## Dashboard

### HR Dashboard Stats

```http
GET /dashboard/stats
```

Query parameters:

| Name | Type | Description |
| --- | --- | --- |
| `period` | string | One of `today`, `week`, `month`, `year`. Defaults to `month`; any other value also falls back to month. |

Success response `200 OK`:

```json
{
  "total_employes": 150,
  "conges_en_cours": 4,
  "conges_ce_mois": 12,
  "solde_moyen": 16.5,
  "age_moyen": 43.2,
  "par_type": [
    {
      "type": "annuel",
      "total": 10
    }
  ],
  "tendance": [
    {
      "mois": "mai 26",
      "total": 12
    }
  ],
  "par_sexe": [
    {
      "sexe": "F",
      "total": 60
    }
  ],
  "par_statut": [
    {
      "statut": "actif",
      "total": 140
    }
  ],
  "par_fonction": [
    {
      "fonction": "Responsable RH",
      "total": 8
    }
  ],
  "par_service": [
    {
      "service": "Ressources Humaines",
      "total": 20
    }
  ]
}
```

### Formation Dashboard Stats

```http
GET /dashboard/formations-stats
```

Success response `200 OK`:

```json
{
  "annee": 2026,
  "total_formations": 8,
  "nb_employes_formes": 45,
  "taux_completion": 62.5,
  "repartition_type": [
    {
      "type": "interne",
      "total": 5
    }
  ],
  "repartition_service": [
    {
      "service": "Ressources Humaines",
      "total": 12
    }
  ]
}
```

### Age Pyramid

```http
GET /dashboard/pyramide-ages
```

Success response `200 OK`:

```json
[
  {
    "tranche": "20-24",
    "hommes": 2,
    "femmes": 3
  }
]
```

### Seniority Distribution

```http
GET /dashboard/anciennete
```

Success response `200 OK`:

```json
[
  {
    "tranche": "< 5 ans",
    "total": 12
  }
]
```

## JavaScript Example

```javascript
const token = localStorage.getItem('token');

const response = await fetch('http://localhost:8000/api/employes?per_page=20', {
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  },
});

if (!response.ok) {
  throw new Error(`API request failed: ${response.status}`);
}

const employees = await response.json();
console.log(employees.data);
```

## Notes and Implementation Constraints

- `POST /login` authenticates against `responsable_rh.login`, not the default Laravel `users` table.
- All protected endpoints use `auth:rh`, backed by Laravel Sanctum.
- File upload endpoints require `multipart/form-data`; JSON requests are not valid for those endpoints.
- Several delete endpoints return `204 No Content`; clients should not expect JSON in those cases.
- Dashboard age calculation uses SQL date functions. If the database engine changes, verify compatibility for `TIMESTAMPDIFF` and `CURDATE`.
