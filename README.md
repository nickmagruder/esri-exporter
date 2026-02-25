# CrashMap Data Pipeline

**Version:** 0.4.0

A full-stack web tool for importing Washington State crash data from the WSDOT collision
REST API into CrashMap's PostgreSQL database.

WSDOT data source:
<https://remoteapps.wsdot.wa.gov/highwaysafety/collision/data/portal/public/>

CrashMap (destination):
<https://github.com/nickmagruder/crashmap>

The pipeline calls the WSDOT API directly from the backend — no browser copy-paste required.
The operator selects a mode (Pedestrian or Bicyclist) and date range in the UI, the backend
fetches and decodes the double-encoded JSON response, maps all fields to CrashMap's schema,
and returns a `.sql` file for the operator to run against the Render PostgreSQL database.

The stack is a React 18 + TypeScript frontend (Vite, TailwindCSS, TanStack Query v5) with a
Python 3.11 + Flask 2.3 backend. No direct database connection — output is always a portable
`.sql` file. See `ARCHITECTURE.md` for technical details and `TUTORIAL.md` for the import runbook.

## Stack

- **Backend**: Python 3.11 + Flask 2.3 (Gunicorn in production)
- **Frontend**: React 18 + TypeScript + TanStack Query v5
- **Tooling**: Vite + TailwindCSS + ESLint
- **Hosting**: Render (full-stack, `render.yaml` in repo root)

## Getting Started

### Prerequisites

- Node.js and npm
- Python 3.11 or higher

### Installation

#### Backend Setup

1. Navigate to the `backend` directory:

```bash
cd backend
```

1. Create and activate a virtual environment:

```bash
python3 -m venv venv  # or: python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

1. Install dependencies:

```bash
pip install -r requirements.txt
```

**Verify the Setup:**

```bash
which python
which pip
```

1. Run the Flask app:

```bash
flask run
```

#### Frontend Setup

1. Navigate to the frontend directory:

```bash
cd frontend
```

1. Install dependencies:

```bash
npm install
```

1. Start the development server:

```bash
npm run dev
```

### Usage

- Backend: **<http://127.0.0.1:5000>**
- Frontend: **<http://127.0.0.1:5173>**

## Changelog

### 2026-02-24 - Initial database population and documentation update (Phase 4 complete)

- Dropped unused columns `"CrashStatePlaneX"` and `"CrashStatePlaneY"` from the Render `crashdata` table
- Truncated existing data and performed full backfill import: 2015–2025 (full years) + January 2026, both modes — 35,632 total records (22,419 pedestrian + 13,213 bicyclist)
- Validated import: zero nulls on key fields, zero null PostGIS geometries, full year/mode coverage confirmed
- Added `TUTORIAL.md` Stage 0 (database preparation) and Stage 5 (data validation) sections
- Added `ARCHITECTURE.md` §13 (database schema preparation, dropped columns, Prisma alignment)
- Updated backfill reference from "10-year / 20 API calls" to reflect actual import scope
- Fixed Python prerequisite version (3.8 → 3.11)
- Bumped version to 0.4.0

### 2026-02-24 - Fix geom generated-column error; verify DO NOTHING behavior (Phase 4)

- Fixed `generate_sql()` to omit `"geom"` from INSERT statements — it is a PostgreSQL generated column computed automatically from `"Latitude"` and `"Longitude"`; explicitly inserting it raised `ERROR: cannot insert a non-DEFAULT value into column "geom"`
- Added `test_generate_sql_cross_report_duplicate_do_nothing` unit test (10 total): verifies `ON CONFLICT DO NOTHING` SQL structure for the cross-report duplicate scenario using a real CRN
- Verified `DO NOTHING` idempotency in PGAdmin with live 2025 data: pedestrian self-re-import → `INSERT 0 0` on all batches; 2025 pedestrian and bicyclist CRNs are disjoint (no cross-report duplicates in this dataset)
- Updated `ARCHITECTURE.md`, `CLAUDE.md`: corrected PostGIS section, SQL examples, field mapping table, risk register
- Bumped version to 0.3.3

### 2026-02-24 - Add end-to-end integration tests for both modes (Phase 4)

- Added `backend/test_e2e.py` with 10 live-API integration tests covering both Pedestrian and Bicyclist modes
- Tests cover: WSDOT API reachability, JSON parse + field key validation, full pipeline SQL structure, ColliRptNum integrity, and CrashDate format
- Run with `python test_e2e.py` or `pytest test_e2e.py -v` from the `backend/` directory (venv active, network access required)
- Bumped version to 0.3.2

### 2026-02-24 - Fix CityName null coercion for WSDOT placeholder value

- Extended `map_placeholder()` (formerly `map_region()`) to also coerce `CityName` to `NULL` when the value is a bare apostrophe (`'`) — the same WSDOT placeholder pattern used in `RegionName`
- Added unit test `test_generate_sql_null_coercion_city_placeholder` covering this case
- Bumped version to 0.3.1

### 2026-02-24 - Refactor frontend to use TanStack Query v5

- Added `@tanstack/react-query` v5 (`useMutation`) for all API calls in `form.component.tsx`
- Wrapped app root in `QueryClientProvider` in `main.tsx`
- Replaces manual `isLoading`/`error`/`success` state with `mutation.isPending`, `mutation.isError`, `mutation.isSuccess`, and `mutation.error`
- `mutationFn` handles the fetch; `onSuccess` callback triggers the blob download
- Applied to both the primary fetch endpoint and the debug fix-json section

### 2026-02-24 - Frontend refactor: mode selector + date range pickers (Phase 3, partial)

- Replaced old fix-JSON form with a functional CrashMap Data Pipeline UI
- Added Mode dropdown (`Pedestrian` / `Bicyclist`) and Start/End date pickers
- "Fetch from WSDOT & Download SQL" button calls `POST /api/fetch-and-generate-sql` and triggers a `.sql` file download via Blob URL; filename includes mode and date range
- Collapsible "Debug: Fix Raw JSON" section retains the original `POST /api/fix-json` workflow
- Removed unused `json-to-csv-export` / `export-from-json` imports from the form component
- Bumped version to 0.2.1

### 2026-02-24 - Implement `POST /api/fetch-and-generate-sql` (Phase 2 complete)

- Implemented `POST /api/fetch-and-generate-sql` endpoint in `backend/app.py`
- Calls WSDOT `GetPublicPortalData` REST API directly from the backend using `requests`
- Maps `Pedestrian` → `Pedestrians by Injury Type` and `Bicyclist` → `Bicyclists by Injury Type` for WSDOT `rptName` param
- Returns `.sql` as `Content-Disposition: attachment` file download; 400 for missing/unrecognized fields, 502 for WSDOT API failures
- Added `requests==2.32.3` to `backend/requirements.txt`
- Bumped version to 0.2.0

### 2026-02-24 - Implement `POST /api/generate-sql`

- Implemented `POST /api/generate-sql` endpoint in `backend/app.py`
- Accepts `multipart/form-data` with a `.txt` file upload, `mode`, and optional `batch_size`
- Runs file content through `fix_malformed_json()` → `generate_sql()` → returns `.sql` as a `Content-Disposition: attachment` file download
- Returns 400 for missing `mode` or `file`; 500 for JSON parse failures

### 2026-02-24 - Add unit tests for `generate_sql()` (Phase 1 complete)

- Added 6 `assert`-based unit tests to `backend/test_json_fixer.py` covering field mapping, NULL coercion (`'` placeholder and empty string), apostrophe escaping, batch splitting, and duplicate `ColliRptNum` / `DO NOTHING` behavior
- Tests use `backend/seattle short.txt` as a real-data fixture and are runnable via `python test_json_fixer.py` or `pytest`

### 2026-02-24 - Implement `generate_sql()` (Phase 1)

- Implemented `generate_sql(records, mode, batch_size=500)` in `backend/app.py`
- Full WSDOT → CrashMap field mapping: NULL coercion, apostrophe escaping, `CrashDate` derivation (`"geom"` excluded — DB-generated column)
- Batched `INSERT ... ON CONFLICT ("ColliRptNum") DO NOTHING` output with header comment block

### 2026-02-24 - CrashMap Data Pipeline architecture planning

- Added `ARCHITECTURE.md` — technical reference for the CrashMap Data Pipeline refactor:
  field mapping, SQL generation strategy, WSDOT API details, duplicate handling, development phases, and risk register
- Added `TUTORIAL.md` — step-by-step operator guide: fetch from WSDOT, generate SQL, import to Render PostgreSQL, refresh materialized views
- Confirmed WSDOT `GetPublicPortalData` REST API is publicly accessible with no authentication (both pedestrian and bicyclist endpoints verified)
- Pipeline design: backend calls WSDOT API directly via `requests`; no browser copy-paste required; DevTools paste retained as fallback

### 2026-02-12 - Add Render deployment for full-stack hosting

- Added Render Blueprint (`render.yaml`) to deploy both Flask backend and React frontend from the same monorepo
- Added `gunicorn` as production WSGI server for the backend
- Configured Flask to bind to Render's dynamic `PORT` environment variable
- Removed unused `seattle.txt` file read that would crash on deploy
- Updated `netlify.toml` to return 404 on `/api/*` routes instead of silently serving HTML

### 2026-02-12 - Add CSV & TXT exports

- Added "Export to .csv" button that downloads fixed JSON as a `.csv` file using `json-to-csv-export`
- Added "Export to .txt File" button that downloads fixed JSON as a `.txt` file using `export-from-json`

### 2026-02-12 - Dependency cleanup and updates

- Fixed duplicate entries in `package.json` (`react`, `react-dom`, `tailwindcss`, `@vitejs/plugin-react`)
- Moved build tools (`tailwindcss`, `autoprefixer`, `postcss`) from `dependencies` to `devDependencies`
- Updated all packages to latest minor/patch versions:
  - `@eslint/js` 9.17.0 → 9.39.2
  - `@types/react` 18.3.18 → 18.3.28
  - `@types/react-dom` 18.3.5 → 18.3.7
  - `@vitejs/plugin-react` 4.3.4 → 4.7.0
  - `autoprefixer` 10.4.20 → 10.4.24
  - `eslint-plugin-react-hooks` 5.1.0 → 5.2.0
  - `postcss` 8.4.49 → 8.5.6
  - `react-router-dom` 6.28.1 → 6.30.3
  - `tailwindcss` 3.4.17 → 3.4.19
  - `typescript` 5.7.2 → 5.9.3
  - `vite` 6.0.7 → 6.4.1
- Resolved all 9 npm audit vulnerabilities (now 0)
- Fixed build command for Netlify Deloyment
- Updated Readme

## License

This project is licensed under the MIT License.
