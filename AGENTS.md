# AGENTS.md — CrashMap Data Pipeline (ESRI Exporter)

> Agent context for the ESRI Exporter / CrashMap Data Pipeline project. Canonical for every
> AI tool; `CLAUDE.md` imports it and adds Claude-only notes.

## Shared standards (clankers)

Universal standards, skills and agents come from the **clankers** repo
(<https://github.com/nickmagruder/clankers>, local: `~/.claude/clankers`) and
load globally. This file holds only what is specific to this project and wins
on conflict. All projects: `~/.claude/clankers/registry/PROJECTS.md`.

## Project Overview

**CrashMap Data Pipeline** (formerly ESRI Exporter) is a full-stack web tool for importing
crash data from the WSDOT collision REST API into CrashMap's PostgreSQL database. The backend
fetches data directly from WSDOT, decodes the JSON-string response, maps fields to
CrashMap's schema, and generates a `.sql` file for the operator to run against the Render DB.

- **WSDOT data source:** <https://remoteapps.wsdot.wa.gov/highwaysafety/collision/data/portal/public/>
- **CrashMap (destination):** <https://github.com/nickmagruder/crashmap>

---

## Stack

| Layer | Technology | Notes |
| --- | --- | --- |
| Frontend | React 19 + TypeScript 6.0 | Vite 8 build tool; TS pinned `~6.0` until typescript-eslint supports TS 7 |
| Styling | Tailwind CSS 4 | `@tailwindcss/vite`; config lives in `src/styles/global.css` (`@theme`) |
| Backend | Python 3.14 + Flask 3.1 | Python pinned in `backend/.python-version` |
| Production server | Gunicorn 27 | Render deployment |
| Hosting | Render (full-stack) | Two dashboard-managed services; `render.yaml` is reference only (see Deployment) |

Current version: **1.0.10** (2026-11-18). No database, no ORM, no auth. The pipeline is stateless — all processing is in-memory,
output is a downloadable `.sql` file.

---

## Key Architecture Decisions

### Data Source

The WSDOT portal has no export button. Data is retrieved via a public REST API:

```text
GET https://remoteapps.wsdot.wa.gov/highwaysafety/collision/data/portal/public/
    Api/CrashDataPortalService/GetPublicPortalData
    ?rptCategory=Pedestrians%20and%20Pedacyclists
    &rptName=Pedestrians%20by%20Injury%20Type   (or "Bicyclists by Injury Type")
    &reportStartDate=20250101
    &reportEndDate=20251231
```

The endpoint moved in 2026: the old `CrashDataPortalService.svc/REST/` path now returns 404.
If it moves again, read `baseRestUrl` in the portal's
`Scripts/ContentCode/runReportButtonClicked.js` (see `ARCHITECTURE.md` §2, "Endpoint history").

The pipeline backend calls this API directly using `requests`. The operator selects mode
and date range in the UI — no browser copy-paste needed.

Fallback for dev/testing: paste the raw response from the browser DevTools Network tab
(the `GetPublicPortalData` request → Response tab → copy all).

Response size: ~1.1 MB per year of statewide data per mode. The initial backfill
(2015–2025 full years + January 2026, both modes) was ~26 MB total across 24 API calls.

### Input Format

The WSDOT API response is a single-line JSON string containing the record array. The current
endpoint encodes it once. The legacy endpoint and the saved samples encode it twice, with excessive
quote escaping. The existing `fix_malformed_json()` function in `backend/app.py`
handles all unwrapping and is not modified during the pipeline refactor.

### SQL Output Strategy

- All inserts use `ON CONFLICT ("ColliRptNum") DO NOTHING` — non-destructive and idempotent
- **Pedestrian imports always run first**, then bicyclist. This resolves cross-report
  duplicates in favor of the pedestrian record (authoritative by convention).
- No direct database connection from the pipeline. The operator runs the `.sql` file
  via `psql` or a GUI tool against the Render PostgreSQL database.

### Mode Field

WSDOT API responses contain no `Mode` field. The operator selects the mode (`Pedestrian`,
`Bicyclist`, or future modes like `Motor Vehicle`) in the UI before fetching.
The selected value is stamped onto every record during SQL generation.

### Dropped Columns

`CrashStatePlaneX` and `CrashStatePlaneY` from the WSDOT data are **not inserted** into
CrashMap. CrashMap uses `Latitude`, `Longitude`, and the PostGIS `"geom"` column exclusively.

### PostGIS Geometry

`"geom"` is a **generated column** in the CrashMap schema — PostgreSQL computes it
automatically from `"Latitude"` and `"Longitude"`. Do **not** include `"geom"` in INSERT
statements; doing so raises `ERROR: cannot insert a non-DEFAULT value into column "geom"`.

---

## Field Mapping: WSDOT → CrashMap `crashdata`

| WSDOT Field | CrashMap Column | Notes |
| --- | --- | --- |
| `ColliRptNum` | `"ColliRptNum"` | Primary key |
| `Jurisdiction` | `"Jurisdiction"` | Direct map |
| *(not in WSDOT)* | `"StateOrProvinceName"` | Hardcoded `'Washington'` |
| `RegionName` | `"RegionName"` | `'` placeholder → `NULL` |
| `CountyName` | `"CountyName"` | Direct map |
| `CityName` | `"CityName"` | `'` placeholder → `NULL` |
| `FullDate` | `"FullDate"` | ISO 8601 text as-is |
| `FullDate` (parsed) | `"CrashDate"` | Date part only: `YYYY-MM-DD` |
| `FullTime` | `"FullTime"` | Direct map |
| `MostSevereInjuryType` | `"MostSevereInjuryType"` | Insert raw — CrashMap bucket-maps |
| `AgeGroup` | `"AgeGroup"` | Empty string → `NULL` |
| `InvolvedPersons` | `"InvolvedPersons"` | Integer (SmallInt in DB) |
| ~~`CrashStatePlaneX`~~ | *(dropped)* | Not needed by CrashMap |
| ~~`CrashStatePlaneY`~~ | *(dropped)* | Not needed by CrashMap |
| `Latitude` | `"Latitude"` | Double Precision |
| `Longitude` | `"Longitude"` | Double Precision |
| *(UI-selected)* | `"Mode"` | `'Pedestrian'`, `'Bicyclist'`, etc. |
| *(generated)* | `"geom"` | Generated column — DB computes from Lat/Lng automatically; **not inserted** |

---

## Key Files

| File | Purpose |
| --- | --- |
| `backend/app.py` | Flask app — `fix_malformed_json()` + API endpoints |
| `backend/requirements.txt` | Python deps (Flask, Flask-Cors, Gunicorn, requests) |
| `backend/test_json_fixer.py` | Unit tests for `fix_malformed_json()` and `generate_sql()` |
| `backend/test_e2e.py` | End-to-end integration tests (live WSDOT API calls, both modes) |
| `backend/seattle short.txt` | Sample malformed WSDOT response for testing |
| `backend/seattle.txt` | Full-size sample (same format, more records) |
| `frontend/src/components/form.component.tsx` | Main UI component |
| `frontend/vite.config.ts` | Dev proxy: `/api` → `localhost:5000` |
| `backend/.python-version` | Pins Render's Python (3.14.3); Render reads it even without a Blueprint |
| `frontend/src/styles/global.css` | Tailwind 4 entry (`@import "tailwindcss"`) + `@theme` overrides |
| `render.yaml` | Reference deployment config; **not applied** by the live services |
| `ARCHITECTURE.md` | Technical reference: field mapping, SQL strategy, WSDOT endpoint history, deployment |
| `TUTORIAL.md` | Operator guide: fetch → generate → import → refresh; troubleshooting |
| `DEPENDENCY_UPGRADE_PLAN.md` | Nov 2026 upgrade plan, all phases done; deferrals and rationale |
| `AGENTS.md` / `CLAUDE.md` | Agent context; `AGENTS.md` is canonical, `CLAUDE.md` imports it plus Claude-only notes |
| `backend/requirements-dev.txt`, `backend/ruff.toml` | Test and lint tools (pytest, ruff) and ruff's rule set |
| `package.json`, `lint-staged.config.js`, `.husky/`, `.nvmrc` | Repo tooling only: pre-commit (ESLint on staged frontend files, then `scripts/gitleaks-staged.sh`) and commit-msg (`scripts/commit-msg.ts`, rules in `scripts/commit-msg-rules.ts`) hooks, set up by `npm install` at the root |
| `.github/workflows/` | `ci.yml` (the required `check` job), `codeql.yml`, `scorecard.yml`; actions pinned by SHA |
| `.github/copilot-instructions.md`, `.github/instructions/`, `.github/skills/code-review/` | Copilot PR review (the skill is synced from clankers `skills/pr-review`) |
| `.github/ISSUE_TEMPLATE/`, `.github/pull_request_template.md`, `.github/dependabot.yml` | Issue forms, PR template, weekly grouped updates |
| `CONTRIBUTING.md`, `SECURITY.md` | Coding standards (also read by Copilot review); vulnerability reporting |

---

## API Endpoints

### `POST /api/fix-json` (existing — retained for debugging)

```json
{ "malformed_json": "<raw API response>" }
```

Returns `{ "fixed_json": "<pretty JSON>", "message": "JSON successfully formatted" }`.

### `POST /api/generate-sql` (implemented)

```text
Request:  multipart/form-data
  file:        <.txt upload>  (fallback path)
  mode:        "Pedestrian" | "Bicyclist" | <other>
  batch_size:  500 (optional)

Response 200: Content-Disposition: attachment — .sql file download
Response 400: { "error": "Missing required field: mode" }
Response 500: { "error": "Failed to parse JSON: <message>" }
```

### `POST /api/fetch-and-generate-sql` (implemented)

```text
Request:  application/json
  mode:          "Pedestrian" | "Bicyclist" | <other>
  start_date:    "YYYYMMDD"
  end_date:      "YYYYMMDD"
  batch_size:    500 (optional)

Response 200: Content-Disposition: attachment — .sql file download
Response 400: { "error": "Missing required field: mode" }
Response 502: { "error": "WSDOT API request failed: <message>" }
```

---

## Development Setup

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py               # http://localhost:5000

# Frontend (new terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

Vite proxies `/api/*` to Flask automatically (`vite preview` on :4173 reuses the same proxy).

**Test with sample data:** Use `backend/seattle short.txt` as a paste/upload fallback,
select Mode = `Bicyclist`, verify SQL output matches the field mapping table above.

---

## Testing & Verification

CI (`.github/workflows/ci.yml`, job `check`) runs the frontend lint, typecheck and build, `ruff check`
and `pytest test_json_fixer.py`, and the commit-message rule tests (`npm test` at the root). The
WSDOT end-to-end tests stay manual.

**Backend** (in `backend/`, venv active; `pip install -r requirements-dev.txt` for the tools):

- `ruff check .`: lint (`ruff.toml`).
- `python test_json_fixer.py`: 10 unit tests; needs `seattle short.txt` (restored in v1.0.1 after
  an accidental deletion). Also run with `-W error` to catch deprecations.
- `python test_e2e.py`: 10 tests against the **live** WSDOT API (Jan 2025 window). A failure can
  mean WSDOT is down or has moved the endpoint; check with `curl` before blaming code.
- **SQL guardrail for dependency or refactor work:** generate SQL from `seattle short.txt` (both
  modes) and `seattle.txt` before the change, save it outside the repo, regenerate after, and
  compare byte-for-byte, ignoring only the `-- Generated:` line. It must be identical.
- gunicorn doesn't run on Windows. To smoke-test it, use WSL (Ubuntu): WSL's Python has no `venv`
  module, so `pip install --target <dir> --platform manylinux2014_x86_64 --only-binary=:all:` from
  the Windows venv and run `PYTHONPATH=<dir> python3 -m gunicorn app:app` in WSL. Run `wsl` with
  `MSYS_NO_PATHCONV=1` from Git Bash.

**Frontend** (in `frontend/`):

- `npm run typecheck` (`tsc -b`): **`npm run build` does not type-check** (it's `vite build` only), so run this separately.
- `npm run lint` (ESLint 10 flat config + React Compiler rules) and `npm run build`.
- **Visual regression check used for upgrades:** in the browser, snapshot `getComputedStyle` of
  every element (debug panel open) before the change, then compare after, in both `npm run dev`
  and the production build via `npm run preview`. Expect 0 differences.
- Manual flow: fetch → `.sql` download through the `/api` proxy, **Debug: Fix Raw JSON**, and the
  start > end date validation.

---

## Deployment (Render)

| Service | Type | URL | Deploys |
| --- | --- | --- | --- |
| `esri-exporter` | Python web service (API) | <https://esri-exporter.onrender.com> | Auto on commit to `main` |
| `esri-exporter-web` | Static site (the app) | <https://esri-exporter-web.onrender.com> | Auto on commit (root `./frontend`) |

- Both services were **created in the dashboard, not from `render.yaml`**: the names differ from
  the file, and its env vars are not applied. Pin versions in ways Render reads directly:
  - Backend Python: `backend/.python-version`
  - Frontend Node: dashboard env var `NODE_VERSION=24`
- Static site build command (dashboard): `npm install && npm run build`; publish dir `dist`. The
  `/api/*` → backend rewrite is a **dashboard** rule.
- The backend root `/` returns 404 (only `/api/...` routes exist). Render's deploy-time probe
  (`HEAD /`) also gets a 404, which is harmless. `GET /api` is the health check.
- PR Previews are **off** on both services.
- The Render deploy-log page can lag several minutes behind the actual deploy. Comparing the live
  asset file names (`curl <site> | grep assets/index-`) with the build output is a faster check.
- Rollback: revert the PR, or use the dashboard's **Rollback** on the previous deploy. The pipeline
  is stateless.

---

## Git Workflow

**Overrides clankers:** the user normally makes commits and pull requests manually in
**GitHub Desktop**. Do not create branches or commits, stage files, or open PRs unless the user
explicitly asks for that in the current session. Otherwise, when work is ready to commit,
summarize the changes clearly so the user can write the commit message themselves.

- The user creates **one branch per change** from an up-to-date `main` before work starts.
  If the current branch has already been merged, ask for a new branch before editing.
- **Issues track the work** (trunk-based, clankers `standards/github.md`): every change has a GitHub
  issue on the [Map Data Exporter board](https://github.com/users/nickmagruder/projects/3); branches
  are named `<type>/<issue>-<slug>`; the PR body starts `Closes #N` (template in `.github/`).
  Bugs and follow-ups found mid-task become issues (`follow-up` or `bug` label), added with
  `gh project item-add 3 --owner nickmagruder --url <url>`, not just notes here.
- `main` is protected by a ruleset: changes land only through a PR with the `check` job green and
  up to date, squash-merged by the user. Never push to `main` or use `--no-verify`.
- **Copilot reviews every PR** automatically. When an agent opened the PR, it fixes the valid
  comments, replies with a reason to the rest and resolves the threads before handing it back.
- Avoid git commands that stage as a side effect. For example, `git checkout <rev> -- <file>`
  stages the file; use `git show <rev>:<path> > <path>` instead.
- At the end of a change, provide a ready-to-paste commit message (summary + description)
  and, when asked, PR text. Link issues with `Part of #N` (stays open) or `Closes #N`.
- `AGENTS.md` and `CLAUDE.md` are **tracked, and this repo is public**: keep secrets and personal
  details out of them. `.claude/` stays gitignored. Deeper technical detail belongs in
  `ARCHITECTURE.md`, `TUTORIAL.md` and `README.md`.

---

## Versioning and changelog

Follows the clankers docs standard. Project specifics:

- The version is the `**Version:**` line near the top of `README.md`. MINOR examples here: SQL
  generation, direct API fetch, bulk import. MAJOR: breaking changes to the API or pipeline behavior.
- The changelog is at the bottom of `README.md`, **newest first**, one `### YYYY-MM-DD — Title`
  heading per change.

---

## Phase 8: Build Data Ingestion Pipeline

### Phases 8.1–8.5 — Docs, generate_sql, API, frontend, hardening ✅

Done 2026-02-12 to 2026-02-24 (see the README changelog): `ARCHITECTURE.md` and `TUTORIAL.md`,
`generate_sql()` with unit tests, both SQL-generating endpoints, the mode and date-range UI on
TanStack Query v5, live end-to-end tests for both modes, the Render deploy, and the initial import.

### Phase 8.6 — Dependency Upgrades (Nov 2026) ✅

Done in v1.0.1–v1.0.7 (PRs #39, #42–#46, issue #38). See `DEPENDENCY_UPGRADE_PLAN.md`.

- [x] Restore test fixtures; patch/minor bumps; remove unused frontend packages; pin Werkzeug
- [x] Runtimes: Python 3.14.3 (`backend/.python-version`), Node 24 (Render dashboard)
- [x] ESLint 8 → 10 (fixed: lint previously couldn't run); `npm run lint` script added
- [x] Flask 3.1, Flask-Cors 6, gunicorn 27 (no code changes)
- [x] React 19 (no code changes; JS bundle 180 → 261 kB)
- [x] Tailwind 4 via `@tailwindcss/vite`. Two overrides in `global.css` keep the UI identical:
  Tailwind 3's `--font-sans` stack, and `padding: revert` on `::-webkit-datetime-edit-fields-wrapper`.
  The app uses **no Tailwind utility classes**; only Preflight.
- [x] TypeScript 6.0 (pinned `~6.0`; typescript-eslint peer range is `<6.1.0`)
- [x] Vite 7 → 8 (Rolldown/Oxc; build ~0.1–0.4 s), plugin-react 6
- Deferred: **TypeScript 7** (typescript-eslint can't run on it yet; TS 7.0 has no programmatic API)
  and **Python 3.15** (released 2026-10-09; wait for a few point releases)
- Fixed along the way (v1.0.2): WSDOT endpoint moved, and stale `test_e2e.py` `"geom"` assertion

### Phase 9 — Iteration & Bugs (Ongoing)

- [ ] Add fallback "Paste / Upload" tab for manual input
- [ ] Show SQL preview (first 50 lines) + record count before download
- [ ] Add a root `/` route to the Flask backend. `https://esri-exporter.onrender.com/` currently
  returns 404, because only `/api/...` routes exist, and both the Render dashboard link and Render's
  deploy probe (`HEAD /`) hit it. Either redirect to `https://esri-exporter-web.onrender.com` or
  return a small status JSON. This is about 5 lines and must not touch `/api` routes or SQL
  generation. Ship it as the next PATCH.
- [ ] Fix stale `frontend/index.html` metadata: `<meta name="description">` still says
  "Tailwind CSS, DaisyUI, and Flask for cost estimation"
- [ ] Re-run the 2025 import (both modes). As of 2026-11-16, WSDOT returns 2,205 pedestrian
  crashes for 2025, vs 2,037 in the Feb 2026 backfill (late reports). `DO NOTHING` makes this safe.
  Records WSDOT later removes are never deleted by the pipeline.
- [ ] Close issue #38. Optionally open an issue to track the deferred TypeScript 7 / Python 3.15
  upgrades.
- [ ] Remove leftover starter-kit and hosting files: `STARTHERE.md` (old "Python-React Starter
  Kit" readme), `netlify.toml`, `vercel.json` and the `.vercel` line in `.gitignore`. The app is
  hosted only on Render.

#### Phase 9.1 — Bulk Import

- [ ] Add "Bulk Import" mode: year range selector (e.g. 2015–2024)
- [ ] Backend loops through each year, concatenates all records, generates one `.sql` file
- [ ] Add progress indicator for multi-year fetches

---

## Initial Import ✅

The initial backfill (2015–2025 full years plus January 2026, pedestrians before bicyclists for
each period, 24 files) ran in Feb 2026. The generated files are kept in `data/imported/`. Since
then, only periodic refreshes are imported.

## Post-Import Steps (CrashMap)

After running the generated `.sql` against the Render database:

```sql
REFRESH MATERIALIZED VIEW filter_metadata;
REFRESH MATERIALIZED VIEW available_years;
```

These materialized views power CrashMap's filter dropdowns (counties, cities, years).
They must be refreshed manually after every import. See `TUTORIAL.md` for the full runbook.

---

## Important Constraints

- **Do NOT add a direct database connection** to the pipeline. Output is always a `.sql` file.
- **Do NOT modify `fix_malformed_json()`** — it is stable and tested. Build on top of it.
- **Always use `ON CONFLICT DO NOTHING`**, not `DO UPDATE SET`. Existing records are never
  overwritten by the pipeline.
- **Pedestrian imports always run before bicyclist** — this is an operator workflow
  requirement, not enforced by code. Document it clearly; do not try to auto-detect order.
- **CrashMap column names are double-quoted PascalCase** in all SQL. Never use unquoted
  column names — PostgreSQL will lowercase them and the query will fail.
