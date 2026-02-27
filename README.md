# CrashMap Data Pipeline

**Version:** 1.0.0

> A full-stack web tool for importing Washington State pedestrian and bicyclist crash data from the WSDOT collision API into CrashMap's PostgreSQL database.

- **WSDOT data source:** <https://remoteapps.wsdot.wa.gov/highwaysafety/collision/data/portal/public/>
- **CrashMap (destination):** <https://github.com/nickmagruder/crashmap>

---

## Overview

The Washington State Department of Transportation (WSDOT) publishes pedestrian and bicyclist crash data through a public REST API. This pipeline bridges that data source and CrashMap's PostgreSQL database — automatically fetching records, normalizing the response format, mapping fields to CrashMap's schema, and delivering a ready-to-run `.sql` file.

No credentials are required to fetch data. No direct database connection is made by the pipeline — output is always a portable `.sql` file that the operator runs manually against the Render database.

---

## How It Works

```text
1. Select  →  Pick a mode (Pedestrian or Bicyclist) and a date range in the UI
2. Fetch   →  The backend calls the WSDOT REST API and generates a .sql file
3. Import  →  Download the .sql file and run it against CrashMap's PostgreSQL database
```

After importing, refresh CrashMap's materialized views and new records appear on the map.

---

## Features

- **Direct API integration** — fetches crash data from the WSDOT portal automatically; no browser copy-paste required
- **Mode selector** — choose Pedestrian or Bicyclist; the selected mode is stamped onto every record in the output
- **Date range picker** — any range the WSDOT portal supports (up to 10 years back)
- **Safe, idempotent imports** — all inserts use `ON CONFLICT DO NOTHING`; re-importing the same data is always safe
- **Automatic field mapping** — maps WSDOT fields to CrashMap's PostgreSQL schema, including NULL coercion and string sanitization
- **PostGIS ready** — latitude and longitude are inserted; the `geom` geometry column is computed automatically by the database
- **Stateless pipeline** — no database connection in the pipeline itself; output is always a portable `.sql` file

---

## Prerequisites

- **Python** 3.11 or higher
- **Node.js** and npm

---

## Installation

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py              # Runs at http://localhost:5000
```

### 2. Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev                # Runs at http://localhost:5173
```

The Vite dev server proxies all `/api/*` requests to the Flask backend automatically — no separate configuration needed.

---

## Usage

1. Open the pipeline at `http://localhost:5173` (or the deployed Render URL)
1. Select a **Mode**: `Pedestrian` or `Bicyclist`
1. Set a **Start Date** and **End Date**
1. Click **Fetch from WSDOT & Download SQL** — a `.sql` file downloads automatically
1. Run the file against CrashMap's Render PostgreSQL database:

   ```bash
   psql "$DATABASE_URL" -f crashmap_pedestrian_20250101_20251231.sql
   ```

1. Refresh CrashMap's materialized views so new data appears in the app:

   ```sql
   REFRESH MATERIALIZED VIEW filter_metadata;
   REFRESH MATERIALIZED VIEW available_years;
   ```

> **Important:** always import the Pedestrian `.sql` file before the Bicyclist `.sql` file. Some crashes appear in both reports; the pedestrian record is treated as authoritative for shared `ColliRptNum` values.

For the complete import runbook — including database preparation, validation queries, and troubleshooting — see [`TUTORIAL.md`](TUTORIAL.md).

---

## API Reference

| Endpoint | Method | Description |
| -------- | ------ | ----------- |
| `/api/fetch-and-generate-sql` | POST | Calls WSDOT API directly and returns a `.sql` file download |
| `/api/generate-sql` | POST | Generates SQL from a manually uploaded `.txt` file (fallback) |

See [`ARCHITECTURE.md`](ARCHITECTURE.md) §7 for full request/response schemas.

---

## Documentation

| Document | Purpose |
| -------- | ------- |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Technical reference: field mapping, SQL strategy, API details, database schema |
| [`TUTORIAL.md`](TUTORIAL.md) | Operator runbook: fetch → import → refresh → validate |

---

## Stack

| Layer | Technology |
| ----- | ---------- |
| Frontend | React 18 + TypeScript (Vite, TailwindCSS, TanStack Query v5) |
| Backend | Python 3.11 + Flask 2.3 (Gunicorn in production) |
| Hosting | Render (full-stack — `render.yaml` in repo root) |

---

## Changelog

### 2026-02-24 — Initial database population and documentation update

- Dropped unused columns `"CrashStatePlaneX"` and `"CrashStatePlaneY"` from the Render `crashdata` table
- Performed full backfill import: 2015–2025 (full years) + January 2026, both modes — 35,632 total records (22,419 pedestrian + 13,213 bicyclist); all years and modes validated
- Added `TUTORIAL.md` Stage 0 (database preparation) and Stage 5 (data validation)
- Added `ARCHITECTURE.md` §13 (database schema preparation, dropped columns, Prisma alignment)
- Bumped version to 0.4.0

### 2026-02-24 — Fix geom generated-column error; verify DO NOTHING behavior

- Fixed `generate_sql()` to omit `"geom"` from INSERT statements — it is a PostgreSQL generated column computed from `"Latitude"` and `"Longitude"`; explicitly inserting it raised `ERROR: cannot insert a non-DEFAULT value into column "geom"`
- Added unit test for cross-report duplicate `ON CONFLICT DO NOTHING` behavior (10 tests total)
- Verified idempotency in PGAdmin with live 2025 data
- Bumped version to 0.3.3

### 2026-02-24 — Add end-to-end integration tests for both modes

- Added `backend/test_e2e.py` with 10 live-API integration tests covering both Pedestrian and Bicyclist modes
- Tests cover: WSDOT API reachability, JSON parse, field key validation, SQL structure, `ColliRptNum` integrity, and `CrashDate` format
- Run with `python test_e2e.py` or `pytest test_e2e.py -v` from `backend/` (network access required)
- Bumped version to 0.3.2

### 2026-02-24 — Fix CityName null coercion for WSDOT placeholder value

- Extended `map_placeholder()` to coerce `CityName` to `NULL` when the value is a bare apostrophe (`'`) — the same WSDOT placeholder pattern used in `RegionName`
- Bumped version to 0.3.1

### 2026-02-24 — Refactor frontend to use TanStack Query v5

- Added `@tanstack/react-query` v5 (`useMutation`) for all API calls; replaces manual loading/error state
- Wrapped app root in `QueryClientProvider`

### 2026-02-24 — Frontend refactor: mode selector and date range pickers

- Replaced old fix-JSON form with a functional CrashMap Data Pipeline UI
- Added Mode dropdown (`Pedestrian` / `Bicyclist`) and Start/End date pickers
- "Fetch from WSDOT & Download SQL" button calls `/api/fetch-and-generate-sql` and triggers a `.sql` download via Blob URL
- Collapsible "Debug: Fix Raw JSON" section retained
- Bumped version to 0.2.1

### 2026-02-24 — Implement `POST /api/fetch-and-generate-sql`

- Calls WSDOT `GetPublicPortalData` REST API directly from the backend using `requests`
- Maps Pedestrian/Bicyclist mode to the WSDOT `rptName` parameter
- Returns `.sql` as `Content-Disposition: attachment`; 400 for missing fields, 502 for WSDOT failures
- Added `requests==2.32.3` to `backend/requirements.txt`
- Bumped version to 0.2.0

### 2026-02-24 — Implement `POST /api/generate-sql`

- Accepts `multipart/form-data` with a `.txt` file upload, `mode`, and optional `batch_size`
- Returns `.sql` as `Content-Disposition: attachment`; 400 for missing fields, 500 for parse errors

### 2026-02-24 — Add unit tests for `generate_sql()`

- 6 tests covering field mapping, NULL coercion, apostrophe escaping, batch splitting, and `ON CONFLICT DO NOTHING` behavior

### 2026-02-24 — Implement `generate_sql()`

- Full WSDOT → CrashMap field mapping with NULL coercion, `CrashDate` derivation, and batched `INSERT ... ON CONFLICT DO NOTHING`

### 2026-02-24 — Architecture planning and documentation

- Added `ARCHITECTURE.md` and `TUTORIAL.md`
- Confirmed WSDOT `GetPublicPortalData` REST API is publicly accessible with no authentication required

### 2026-02-12 — Add Render deployment

- Added `render.yaml` for full-stack Render hosting (Flask backend + React frontend from one monorepo)
- Added Gunicorn as production WSGI server; configured Flask to bind to Render's dynamic `PORT`

### 2026-02-12 — Dependency cleanup and updates

- Fixed duplicate entries in `package.json`; moved build tools to `devDependencies`
- Updated all packages to latest minor/patch versions; resolved all npm audit vulnerabilities

---

## License

This project is licensed under the MIT License.
