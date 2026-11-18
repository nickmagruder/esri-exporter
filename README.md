# CrashMap Data Pipeline

**Version:** 1.0.10

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
- **Safe, idempotent imports** — guarded upserts refresh same-mode rows, let Pedestrian data replace Bicyclist data, and prevent Bicyclist data from overwriting Pedestrian rows
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

> **Important:** Pedestrian records are authoritative for shared `ColliRptNum` values. The guarded upsert preserves that rule regardless of import order.

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
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How changes are made, coding standards, hooks (`npm install` at the root) |
| [`SECURITY.md`](SECURITY.md) | Reporting a vulnerability privately |

---

## Stack

| Layer | Technology |
| ----- | ---------- |
| Frontend | React 19 + TypeScript 6 (Vite 8, Tailwind CSS 4, TanStack Query v5) |
| Backend | Python 3.14 + Flask 3.1 (Gunicorn 27 in production) |
| Hosting | Render (full-stack — `render.yaml` in repo root) |

---

## Changelog

### 2026-11-18 — Repo standards (CI, hooks, Copilot review)

- `main` is protected by a ruleset (PR required, `check` job required and up to date, no force pushes); merges are squash-only and delete the branch; Copilot reviews every PR
- New CI `check` job: frontend lint, typecheck (new `npm run typecheck`) and build; backend `ruff check` (`backend/ruff.toml`, tools in `backend/requirements-dev.txt`) and the unit tests; plus CodeQL (JS/TS, Python, Actions), OpenSSF Scorecard and weekly grouped Dependabot updates. Actions are pinned by commit SHA
- Root `package.json` for repo tooling only: husky pre-commit (ESLint on staged frontend files, then a gitleaks secret scan) and a commit-msg check, set up by `npm install` at the root
- Removed an unused import and a bare `except` in `backend/app.py` (no behaviour change)
- Added `CONTRIBUTING.md`, `SECURITY.md`, issue forms, a PR template and Copilot review instructions; `AGENTS.md` now tracks work in issues and describes the review flow
- Bumped version to 1.0.10

### 2026-11-17 — Guarded upserts (Phase 10.1)

- Generated SQL now updates matching-mode rows, always lets Pedestrian records replace conflicts, and prevents Bicyclist records from overwriting Pedestrian rows
- The `geom` generated column remains excluded from inserts and updates; duplicate source keys are split across statements so PostgreSQL upserts remain valid
- Updated operator and architecture documentation for order-independent Pedestrian priority and WSDOT data refreshes

### 2026-11-16 — Track agent context files (AGENTS.md, CLAUDE.md)

- Added `AGENTS.md`, the tool-neutral agent context (stack, constraints, testing, deployment, git workflow, to-dos), aligned with the shared clankers standards
- `CLAUDE.md` now imports `AGENTS.md` and adds only Claude Code notes; both are tracked (removed `CLAUDE.md` from `.gitignore`)
- Removed a duplicated "phase 8b (Vite 8)" changelog entry left over from a merge
- Bumped version to 1.0.9

### 2026-11-16 — Documentation: deployment and maintenance notes

- `ARCHITECTURE.md`: new Deployment (Render) section (services, auto-deploy, runtime pins, `/api` rewrite, rollback); stack table now Python 3.14 / Flask 3.1 / Gunicorn 27
- `TUTORIAL.md`: note that WSDOT revises past data, so re-importing the previous year periodically is worthwhile
- `DEPENDENCY_UPGRADE_PLAN.md`: marked complete and deployed (PR #46)
- Bumped version to 1.0.8

### 2026-11-16 — Dependency upgrades, phase 8b (Vite 8)

- `vite` 7.3.8 → 8.3.8 (Rolldown bundler, Oxc transforms, Lightning CSS minification) and `@vitejs/plugin-react` 5.2.0 → 6.3.0 (Babel no longer used in the build); no config changes needed
- Production build is ~4× faster (≈0.4 s); JS 254.9 → 251.7 kB, CSS 6.36 → 6.43 kB
- Verified: tsc, lint and build pass; computed styles of all elements match the Vite 7 build in dev and production preview; fetch → download, Debug: Fix Raw JSON and date validation tested; console clean
- Completes the dependency upgrade plan (#38); TypeScript 7 and Python 3.15 remain deferred
- Bumped version to 1.0.7

### 2026-11-16 — Dependency upgrades, phases 7 + 8a (TypeScript 6, Vite 7)

- `typescript` 5.9.3 → 6.0.3 (pinned `~6.0`: typescript-eslint supports `<6.1.0`; TypeScript 7 deferred); no tsconfig changes needed
- `vite` 6.4.6 → 7.3.8 and `@vitejs/plugin-react` 4.7.0 → 5.2.0; no config changes needed
- Production bundle is slightly smaller because of Vite 7's newer default browser target: JS 260.9 → 254.9 kB, CSS 6.54 → 6.36 kB
- Verified: tsc, lint and build pass; computed styles of all elements match the previous build in both dev and production preview; fetch → download works through the `/api` proxy in both
- Bumped version to 1.0.6

### 2026-11-16 — Dependency upgrades, phase 6 (Tailwind CSS 4)

- `tailwindcss` 3.4.19 → 4.3.5 via `@tailwindcss/vite`; removed `postcss.config.js`, `tailwind.config.js`, and the `postcss` / `autoprefixer` dev dependencies
- `global.css`: `@tailwind` directives → `@import "tailwindcss"`, plus two small overrides that keep the UI identical (Tailwind 3's `--font-sans` stack; browser padding inside date fields)
- Verified: computed styles of every element match the pre-upgrade baseline for layout, fonts and spacing; fetch → download and debug panel tested in the browser; build no longer prints the "No utility classes" warning
- Bumped version to 1.0.5

### 2026-11-16 — Dependency upgrades, phase 5 (React 19)

- `react` / `react-dom` 18.3.1 → 19.3.1, `@types/react` / `@types/react-dom` → 19.3.0; no code changes needed (no removed APIs in use)
- Verified: `tsc -b`, lint and build pass; fetch → download and Debug: Fix Raw JSON tested in the browser through the `/api` dev proxy; no console warnings
- Production JS bundle grows from 180 kB to 261 kB (57 → 81 kB gzipped) because `react-dom` 19 is larger; CSS unchanged
- Bumped version to 1.0.4

### 2026-11-16 — Dependency upgrades, phase 4 (backend majors)

- Flask 2.3.3 → 3.1.3, Flask-Cors 3.0.10 → 6.0.5 (fixes CVE-2024-6866, CVE-2024-6844), gunicorn 21.2.0 → 27.0.1 (stricter HTTP parsing / request-smuggling fixes); no code changes needed
- Added `backend/.python-version` (3.14.3): Render reads it without a Blueprint, so the backend Python version is now pinned instead of relying on Render's default
- Verified: unit tests 10/10 (warnings as errors), live e2e 10/10, generated SQL byte-identical, CORS headers unchanged, gunicorn 27 smoke-tested under WSL with proxy-style headers
- Bumped version to 1.0.3

### 2026-11-16 — Fix WSDOT endpoint (404)

- WSDOT retired `CrashDataPortalService.svc/REST/GetPublicPortalData` (HTTP 404); switched `_WSDOT_BASE_URL` in `backend/app.py` and `backend/test_e2e.py` to `Api/CrashDataPortalService/GetPublicPortalData` (same parameters, same 14 fields; `fix_malformed_json()` unchanged)
- Fixed stale `test_e2e.py` assertion that required `"geom"` in INSERTs; it now asserts `"geom"` is absent (generated column). Live e2e tests pass 10/10
- Documented the endpoint history and how to find the current URL (`ARCHITECTURE.md` §2, `TUTORIAL.md` Troubleshooting)
- Documented that the live Render services are dashboard-managed, so `render.yaml` env vars are not applied, and that the static site does not auto-deploy
- Bumped version to 1.0.2

### 2026-11-16 — Dependency upgrades, phases 0–3

- Restored `backend/seattle short.txt` and `backend/seattle.txt` test fixtures (deleted in the initial import commit); unit tests pass 10/10 again
- Backend patch/minor bumps: Flask 2.3.3, requests 2.34.2; pinned Werkzeug 3.1.9 to keep dev and Render installs in sync
- Frontend patch/minor bumps (TanStack Query 5.107, Vite 6.4.6, PostCSS, Autoprefixer, `@types/react`); removed unused `react-router-dom`, `export-from-json`, `json-to-csv-export`; applied `npm audit fix` (0 vulnerabilities)
- Render: Python 3.11.6 → 3.14.3; pinned the static site to Node 24; added `engines.node >=20.19`
- Replaced deprecated `datetime.utcnow()` with `datetime.now(timezone.utc)` (generated SQL unchanged)
- ESLint 8 → 10 with typescript-eslint, react-hooks v7 and react-refresh; installed the previously missing lint packages and added `npm run lint`
- Added `DEPENDENCY_UPGRADE_PLAN.md`; bumped version to 1.0.1

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
