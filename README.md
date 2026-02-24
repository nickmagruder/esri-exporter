# ESRI Exporter

**Version:** 0.3.1

An application for capturing and converting map data from ESRI map applications. Currently, this application works just for capturing crash data from the WSDOT ESRI map for the purposed of reusing the data in a more full-featured app I'm building called CrashMap.

WSDOT Map:
<https://remoteapps.wsdot.wa.gov/highwaysafety/collision/data/portal/public/>

CrashMap:
<https://github.com/nickmagruder/crashmap>

The application follows a full-stack monorepo structure with a React/TypeScript frontend (built with Vite and styled with Tailwind CSS) and a Python Flask backend. The two layers communicate via a REST API: a Vite dev proxy routes `/api` requests to Flask during development, keeping the frontend and backend independently deployable. The frontend uses functional React components with local `useState` hooks for form state. No global state manager is needed given the single-feature scope. The core backend logic is a JSON normalization pipeline that unwraps the double-encoded, over-escaped JSON that ESRI map exports produce, returning clean, human-readable output suitable for downstream use.

## Built starting with the Python-React Starter Kit

A simple template for building full-stack applications with Python and React.

## Features

- **Backend**: Flask (Python)
- **Frontend**: React
- **Tooling**: Vite for fast frontend builds
- **Styling**: TailwindCSS
- **Clean Code**: ESLint

## Getting Started

### Prerequisites

- Node.js and npm
- Python 3.8 or higher

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
- Full WSDOT → CrashMap field mapping: NULL coercion, apostrophe escaping, `CrashDate` derivation, PostGIS `geom` generation
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
