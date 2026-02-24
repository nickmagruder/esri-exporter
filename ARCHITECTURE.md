# CrashMap Data Pipeline — Architecture Guide

> **CrashMap Data Pipeline** is a refactored version of the ESRI Exporter tool, purpose-built
> to fetch crash data from the WSDOT collision REST API and convert it into SQL ready for
> insertion into CrashMap's PostgreSQL database.

---

## 1. Introduction

### Purpose

The Washington State Department of Transportation (WSDOT) exposes bicyclist and pedestrian
crash data through a public REST API (the ESRI map portal's data service). The response is a
double-encoded JSON string that is not directly usable.

This pipeline calls the WSDOT API from the backend, normalizes the JSON, maps fields to
CrashMap's database schema, and outputs a `.sql` file containing batched `INSERT` statements
ready to run against CrashMap's PostgreSQL database on Render.

### Design Philosophy

- **Stateless.** No database connection in the pipeline itself. The output is a portable `.sql`
  file that the operator runs manually via `psql` or a GUI tool. Credentials never touch the
  pipeline.
- **Server-side fetching and processing.** The backend calls the WSDOT API directly — no
  browser copy-paste required. Supports bulk multi-year imports.
- **Non-destructive.** All inserts use `ON CONFLICT DO NOTHING`. Re-importing the same data
  is always safe.
- **Minimal dependencies.** SQL generation uses only Python's standard library. Only `requests`
  is added for the WSDOT API calls.

### Source → Destination

```text
WSDOT REST API
(CrashDataPortalService.svc)
         │  HTTP GET (from Flask backend)
         ▼
┌─────────────────────────────┐
│   CrashMap Data Pipeline    │
│   (ESRI Exporter — refact.) │
│                             │
│   React Frontend (Vite)     │  ← date range + mode UI
│      + Flask Backend        │  ← fetches WSDOT, generates SQL
└──────────────┬──────────────┘
               │ .sql file download
               ▼
    Operator runs via psql
               │
               ▼
┌──────────────────────────────┐
│  CrashMap PostgreSQL + PostGIS│
│  crashdata table (Render)    │
└──────────────────────────────┘
               │
               ▼
    REFRESH MATERIALIZED VIEW
               │
               ▼
    CrashMap app (crashmap.io)
    reflects new records
```

---

## 2. Input Data Structure

### WSDOT REST API

The pipeline calls the WSDOT collision data REST API directly from the Flask backend.
There is no export button on the portal — the data is fetched programmatically.

**Endpoint:**

```text
GET https://remoteapps.wsdot.wa.gov/highwaysafety/collision/data/portal/public/
    CrashDataPortalService.svc/REST/GetPublicPortalData
```

**Parameters:**

| Parameter | Values | Notes |
| --- | --- | --- |
| `rptCategory` | `Pedestrians and Pedacyclists` | Same for both modes |
| `rptName` | `Pedestrians by Injury Type` or `Bicyclists by Injury Type` | Driven by Mode selector |
| `reportStartDate` | `YYYYMMDD` | e.g. `20250101` |
| `reportEndDate` | `YYYYMMDD` | e.g. `20251231` |
| `locationType` | *(empty)* | Optional geographic filter |
| `locationName` | *(empty)* | Optional geographic filter |
| `jurisdiction` | *(empty)* | Optional geographic filter |

**Example — one year of statewide pedestrian data:**

```text
https://remoteapps.wsdot.wa.gov/highwaysafety/collision/data/portal/public/
CrashDataPortalService.svc/REST/GetPublicPortalData
?rptCategory=Pedestrians%20and%20Pedacyclists
&rptName=Pedestrians%20by%20Injury%20Type
&locationType=&locationName=&jurisdiction=
&reportStartDate=20250101&reportEndDate=20251231
```

**Response size:** ~1.1 MB per year of statewide pedestrian data. The 10-year backfill
(2015–2024, both modes) requires 20 API calls and generates roughly 22 MB of JSON total.

**Workaround for development/testing:** If direct API calls are unavailable (network
restrictions, API changes), the original text-paste / file-upload workflow still works.
Paste or upload the raw response body copied from the browser DevTools Network tab.

### Response Format

The API returns a single-line, double-encoded JSON string wrapped in outer quotes.

**Raw file content (abbreviated):**

```text
"\"[{\\\"ColliRptNum\\\":\\\"3838031\\\",\\\"Jurisdiction\\\":\\\"City Street\\\", ...}]\""
```

**After decoding** (what the array actually contains):

```json
[
  {
    "ColliRptNum": "3838031",
    "Jurisdiction": "City Street",
    "RegionName": "'",
    "CountyName": "King",
    "CityName": "Seattle",
    "FullDate": "2025-02-21T00:00:00",
    "FullTime": "11:06 AM",
    "MostSevereInjuryType": "Suspected Minor Injury",
    "AgeGroup": "",
    "InvolvedPersons": 4,
    "CrashStatePlaneX": 1192299.06,
    "CrashStatePlaneY": 837515.73,
    "Latitude": 47.615677169795,
    "Longitude": -122.316864546986
  }
]
```

### Known Data Quality Issues

| Field | Issue | Handling |
|-------|-------|----------|
| `RegionName` | Often contains `'` as a placeholder value | Normalize to `NULL` |
| `AgeGroup` | Frequently empty string | Normalize empty string to `NULL` |
| `ColliRptNum` | May appear in both ped and bike exports | Handled by `ON CONFLICT DO NOTHING` + pedestrian-first insertion order |
| `CrashStatePlaneX/Y` | Present but not used by CrashMap | Dropped during field mapping |

---

## 3. Field Mapping: WSDOT → CrashMap

CrashMap's `crashdata` table uses PascalCase quoted column names (a PostgreSQL convention
inherited from the original Prisma schema introspection). All column names in INSERT
statements must be double-quoted.

### Complete Mapping

| WSDOT Field             | CrashMap Column            | Type            | Notes                                          |
|-------------------------|----------------------------|-----------------|------------------------------------------------|
| `ColliRptNum`           | `"ColliRptNum"`            | String (PK)     | Primary key; drives conflict resolution        |
| `Jurisdiction`          | `"Jurisdiction"`           | String          | Direct map                                     |
| *(not in WSDOT)*        | `"StateOrProvinceName"`    | String          | Hardcoded `'Washington'` — WSDOT is WA-only    |
| `RegionName`            | `"RegionName"`             | String          | `'` placeholder → `NULL`                       |
| `CountyName`            | `"CountyName"`             | String          | Direct map                                     |
| `CityName`              | `"CityName"`               | String          | Direct map                                     |
| `FullDate`              | `"FullDate"`               | String          | ISO 8601: `2025-02-21T00:00:00`               |
| `FullDate` (parsed)     | `"CrashDate"`              | Date            | Date portion only: `2025-02-21`               |
| `FullTime`              | `"FullTime"`               | String          | Direct map                                     |
| `MostSevereInjuryType`  | `"MostSevereInjuryType"`   | String          | Direct map                                     |
| `AgeGroup`              | `"AgeGroup"`               | String          | Empty string → `NULL`                          |
| `InvolvedPersons`       | `"InvolvedPersons"`        | SmallInt        | Integer                                        |
| ~~`CrashStatePlaneX`~~  | *(dropped)*                | —               | Not used; CrashMap uses Lat/Long + PostGIS     |
| ~~`CrashStatePlaneY`~~  | *(dropped)*                | —               | Not used; CrashMap uses Lat/Long + PostGIS     |
| `Latitude`              | `"Latitude"`               | Double Precision| Direct map                                     |
| `Longitude`             | `"Longitude"`              | Double Precision| Direct map                                     |
| *(UI-selected)*         | `"Mode"`                   | String          | Manually set per export — see §4               |
| *(computed)*            | `"geom"`                   | geometry        | `ST_SetSRID(ST_MakePoint(lng, lat), 4326)`     |

---

## 4. Mode Field

### Why Mode Is Manual

The WSDOT portal exports separate reports by victim type:

- **"Pedestrians by Injury Type"** — all records are pedestrian crashes
- **"Bicyclists by Injury Type"** — all records are bicyclist crashes

The WSDOT API response contains **no field indicating the mode**. The operator selects
the mode in the pipeline UI before fetching. The selected value is stamped onto every record
during SQL generation.

### Future Extensibility

CrashMap may expand to include motor vehicle crashes. The Mode selector is an open dropdown
(not hardcoded to two values) so that `"Motor Vehicle"` or other modes can be added to the
UI without a backend code change.

---

## 5. SQL Generation Strategy

### Statement Structure

```sql
INSERT INTO crashdata (
  "ColliRptNum", "Jurisdiction", "StateOrProvinceName", "RegionName",
  "CountyName", "CityName", "FullDate", "CrashDate", "FullTime",
  "MostSevereInjuryType", "AgeGroup", "InvolvedPersons",
  "Latitude", "Longitude", "Mode", "geom"
) VALUES
  (...),
  (...)
ON CONFLICT ("ColliRptNum") DO NOTHING;
```

### ON CONFLICT / Duplicate Handling

The same `ColliRptNum` can appear in both the pedestrian and bicyclist exports when a single
crash involves both a pedestrian and a bicyclist (e.g., a car hits a cyclist who was walking
their bike). Both reports contain identical data except that the operator would have selected
different modes.

**Rule: the pedestrian record is authoritative.**

- Always import the **pedestrian** `.sql` file first
- Then import the **bicyclist** `.sql` file
- `ON CONFLICT DO NOTHING` silently skips any `ColliRptNum` that already exists, regardless
  of which file introduced it

This means:

- Cross-report duplicates are retained as pedestrian records
- Re-importing the same file twice is always safe (idempotent)
- The pipeline never overwrites an existing record

### Batching

Large exports are split into batches of 500 rows per INSERT statement. This prevents hitting
PostgreSQL's parameter limit and keeps individual statements manageable in logs and query plans.
Batch size is configurable via the API.

### String Escaping

All string values use manual `''` escaping (doubling single quotes). No external database
driver is needed in the pipeline — the output is a plain text `.sql` file.

Examples:

- `O'Brien` → `'O''Brien'`
- `""` (empty) → `NULL`
- `'` (RegionName placeholder) → `NULL`

### CrashDate Derivation

`"CrashDate"` is a proper PostgreSQL `DATE` column used for range filtering in CrashMap.
It is derived from `FullDate` by extracting the date portion:

```text
"2025-02-21T00:00:00"  →  '2025-02-21'
```

### PostGIS Geometry Column

The `"geom"` column uses the PostGIS `geometry` type with SRID 4326 (WGS 84 / GPS coordinates).
Every INSERT includes an explicit geometry value:

```sql
ST_SetSRID(ST_MakePoint(<longitude>, <latitude>), 4326)
```

Note the argument order: **longitude first**, then latitude — this is the PostGIS convention
(x, y = lng, lat).

### Sample Output

```sql
-- CrashMap Data Import
-- Mode: Pedestrian
-- Generated: 2026-02-24
-- Records: 7

INSERT INTO crashdata (
  "ColliRptNum", "Jurisdiction", "StateOrProvinceName", "RegionName",
  "CountyName", "CityName", "FullDate", "CrashDate", "FullTime",
  "MostSevereInjuryType", "AgeGroup", "InvolvedPersons",
  "Latitude", "Longitude", "Mode", "geom"
) VALUES
  ('3838031', 'City Street', 'Washington', NULL, 'King', 'Seattle',
   '2025-02-21T00:00:00', '2025-02-21', '11:06 AM', 'Suspected Minor Injury',
   NULL, 4, 47.615677169795, -122.316864546986,
   'Pedestrian', ST_SetSRID(ST_MakePoint(-122.316864546986, 47.615677169795), 4326)),
  ('3887523', 'City Street', 'Washington', NULL, 'King', 'Seattle',
   '2025-02-01T00:00:00', '2025-02-01', '1:20 AM', 'Died in Hospital',
   NULL, 2, 47.668680009423, -122.376289485757,
   'Pedestrian', ST_SetSRID(ST_MakePoint(-122.376289485757, 47.668680009423), 4326))
ON CONFLICT ("ColliRptNum") DO NOTHING;
```

---

## 6. Application Architecture

### System Overview

```text
┌─────────────────────────────────────────────────────────┐
│                  React Frontend (Vite)                   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │               form.component.tsx                  │   │
│  │                                                   │   │
│  │  [Mode ▼]  [Start Year ▼]  [End Year ▼]           │   │
│  │                                                   │   │
│  │  [Fetch from WSDOT & Generate SQL]                │   │
│  │                                                   │   │
│  │  Preview: <first 50 lines>   Records: N           │   │
│  │  [Download .sql]  [Debug: View JSON ▼]            │   │
│  │                                                   │   │
│  │  ── Fallback tab ──────────────────────────────   │   │
│  │  [Paste / Upload raw response]                    │   │
│  └─────────────────────────┬─────────────────────────┘   │
└────────────────────────────┼────────────────────────────┘
                             │ POST /api/fetch-and-generate-sql
                             │ application/json
                             ▼
┌─────────────────────────────────────────────────────────┐
│                  Flask Backend (Python)                  │
│                                                          │
│  POST /api/fetch-and-generate-sql                        │
│    1. Build WSDOT URL from mode + date range             │
│    2. requests.get(wsdot_url) → raw response             │
│    3. fix_malformed_json()  ← reused unchanged           │
│    4. json.loads() → list of crash dicts                 │
│    5. generate_sql(records, mode, batch_size)            │
│    6. Return .sql as file download                       │
│                                                          │
│  POST /api/generate-sql  (fallback: file/paste upload)   │
│  POST /api/fix-json       (debug utility)                │
└─────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + TypeScript | 18.x / 5.x |
| Build tool | Vite | 6.x |
| Styling | TailwindCSS | 3.x |
| Backend | Python + Flask | 3.11 / 2.3 |
| Production server | Gunicorn | 21.x |
| Hosting | Render (full-stack) | — |

### Key Files

| File | Role |
|------|------|
| `backend/app.py` | Flask app — JSON fixer + SQL generator |
| `backend/test_json_fixer.py` | Unit tests |
| `backend/seattle short.txt` | Sample malformed JSON for testing |
| `frontend/src/components/form.component.tsx` | Main UI component |
| `render.yaml` | Full-stack Render deployment config |

---

## 7. API Reference

### Existing: `POST /api/fix-json`

Retained for debugging raw JSON output.

**Request:**

```json
{ "malformed_json": "<raw .txt file content>" }
```

**Response:**

```json
{ "fixed_json": "<pretty-printed JSON>", "message": "JSON successfully formatted" }
```

### New: `POST /api/fetch-and-generate-sql` (primary)

Calls the WSDOT API from the backend — no file upload needed.

**Request:** `application/json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mode` | String | Yes | `"Pedestrian"`, `"Bicyclist"`, or other |
| `start_date` | String | Yes | `YYYYMMDD` — e.g. `"20250101"` |
| `end_date` | String | Yes | `YYYYMMDD` — e.g. `"20251231"` |
| `batch_size` | Integer | No | Rows per INSERT (default: 500) |

**Response 200:**

```text
Content-Type: application/sql
Content-Disposition: attachment; filename="crashmap_import_2026-02-24.sql"

<SQL file content>
```

**Response 400:** `{ "error": "Missing required field: mode" }`

**Response 502:** `{ "error": "WSDOT API request failed: <message>" }`

### New: `POST /api/generate-sql` (fallback — file/paste upload)

For cases where direct API fetch is unavailable.

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `file` | File (.txt) | Yes | Raw WSDOT response saved as file |
| `mode` | String | Yes | `"Pedestrian"`, `"Bicyclist"`, or other |
| `batch_size` | Integer | No | Rows per INSERT (default: 500) |

**Response 200:** Same `.sql` file download as primary endpoint.

**Response 400:** `{ "error": "Missing required field: mode" }`

**Response 500:** `{ "error": "Failed to parse JSON: <message>" }`

---

## 8. Development Phases

Hours per week are TBD based on team availability. Phases are ordered by dependency;
phases 1–3 must complete before 4–6.

### Phase 1 — Foundation & Field Mapping

**Goal:** Working `generate_sql()` function with unit tests.

- Audit `fix_malformed_json()` for large-file robustness (currently processes strings
  in memory; no changes expected for files up to ~50MB)
- Implement `generate_sql(records, mode, batch_size=500) → str` in `backend/app.py`
- Implement field mapping: NULL coercion, `'` sanitization, string escaping, `CrashDate`
  derivation, `geom` generation
- Add unit tests to `backend/test_json_fixer.py` covering:
  - Basic mapping with sample data
  - NULL coercion (empty string, `'` placeholder)
  - String escaping (apostrophes in city/county names)
  - Batch splitting
  - Known-duplicate `ColliRptNum` across two imports

### Phase 2 — Backend API

**Goal:** Tested Flask endpoint returning a valid `.sql` file.

- Implement `POST /api/generate-sql` in `backend/app.py`
- Accept `multipart/form-data` file upload (replaces JSON body for this endpoint)
- Return SQL as `Content-Disposition: attachment` response
- Validate required `mode` field; return 400 if missing
- Extend test suite

### Phase 3 — Frontend Refactor

**Goal:** Working end-to-end UI in local dev.

- Replace textarea input with `<input type="file" accept=".txt">` in `form.component.tsx`
- Add Mode selector (combobox or `<select>` with `Pedestrian`, `Bicyclist` as defaults;
  allow free-text entry for future modes)
- Add State field (pre-filled `Washington`, editable)
- Wire file upload to `POST /api/generate-sql` via `FormData`
- Show SQL preview (first 50 lines) and record count
- Add "Download .sql" button via Blob URL
- Retain "Debug: View Fixed JSON" as a collapsible section (still calls `/api/fix-json`)

### Phase 4 — Large File Handling

**Goal:** Pipeline handles statewide WSDOT exports without timeout.

- Profile with full county/statewide exports (estimated 10k–100k records)
- If memory is a concern: stream file in chunks before parsing
- Add progress indicator to frontend (indeterminate spinner during server processing)
- Adjust Render service timeout if needed (default: 30s; may need 120s for large files)

### Phase 5 — Documentation

**Goal:** `ARCHITECTURE.md` and `TUTORIAL.md` complete and reviewed.

- `ARCHITECTURE.md` (this file) — technical reference for developers
- `TUTORIAL.md` — step-by-step operator guide for importing data

### Phase 6 — Testing & Hardening

**Goal:** Production-ready pipeline deployed to Render.

- End-to-end test with real WSDOT exports for both modes
- Verify `DO NOTHING` behavior with known-duplicate `ColliRptNum` values
- Edge cases: `RegionName: "'"`, empty `AgeGroup`, extreme lat/long values
- Deploy to Render, validate `.sql` downloads and CrashMap materialized view refresh

---

## 9. Suggested Libraries and Tools

### Backend (Python — one new pip dependency: `requests`)

| Tool | Purpose | Notes |
| --- | --- | --- |
| `requests` | WSDOT API calls | Add to `backend/requirements.txt` |
| `json` (stdlib) | JSON parsing | Already used in `fix_malformed_json()` |
| `io` / `werkzeug` | File upload handling (fallback) | Flask provides via `request.files` |
| `datetime` (stdlib) | Date formatting | For header comment timestamps |

### Frontend (no new npm packages required)

| Tool | Purpose | Notes |
|------|---------|-------|
| `Blob` + `URL.createObjectURL` | SQL file download | Already used pattern for CSV/TXT export |
| React `useState` | File and mode state | Existing pattern in `form.component.tsx` |

### Operator Tools (external)

| Tool | Purpose |
|------|---------|
| `psql` | Execute `.sql` file against Render PostgreSQL |
| pgAdmin / TablePlus / DBeaver | GUI alternative to `psql` for running SQL files |
| PostGIS (already on Render DB) | Provides `ST_MakePoint`, `ST_SetSRID` functions |

---

## 10. Post-Import Runbook

After executing the `.sql` file against CrashMap's Render database, run the following
to make new records visible in the app. See `TUTORIAL.md` for the full step-by-step guide.

```sql
-- Refresh both materialized views
REFRESH MATERIALIZED VIEW filter_metadata;
REFRESH MATERIALIZED VIEW available_years;
```

**Verify the import:**

```sql
-- Check record count by mode and year
SELECT "Mode", EXTRACT(YEAR FROM "CrashDate") AS year, COUNT(*)
FROM crashdata
GROUP BY "Mode", year
ORDER BY year DESC, "Mode";
```

CrashMap's filter dropdowns (counties, cities, years) are populated from these materialized
views. They will not reflect new data until both views are refreshed.

---

## 11. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Large files cause Render request timeout | High | High | Chunked reads; raise Render service timeout to 120s; add progress indicator |
| WSDOT export format adds or removes fields | Medium | High | Schema validation before SQL gen; log unknown fields as warnings |
| `RegionName: "'"` data quality issue | High | Low | Normalize any value that is only whitespace or `'` → `NULL` |
| SQL injection via crash data string values | Low | High | `''` escaping on all string values; never interpolate raw values via f-strings |
| Operator runs bicyclist import before pedestrian | Medium | Medium | Warn prominently in TUTORIAL.md; consider a pipeline-level UI warning prompt |
| PostGIS `ST_MakePoint` fails on bad coordinates | Low | Medium | Validate lat/long ranges before generating SQL; skip records with `NULL` coordinates |
| Mode selected incorrectly for uploaded file | Medium | High | Show record count and sample data in preview before download; require explicit confirmation |
| Render DB PostGIS extension not enabled | Low | High | Verify once with `SELECT PostGIS_Version();`; document in TUTORIAL.md setup checklist |

---

## 12. Relationship to CrashMap

This pipeline feeds into CrashMap's data tier. Key CrashMap architectural details relevant
to this pipeline:

- **Table:** `crashdata` — single PostgreSQL table with PascalCase quoted column names
- **Primary key:** `"ColliRptNum"` (String)
- **Spatial index:** `idx_crashdata_geom` (GIST) on the `"geom"` column
- **Mode values:** CrashMap queries use `"Bicyclist"` and `"Pedestrian"` exactly — case matters
- **Severity mapping:** CrashMap maps raw `"MostSevereInjuryType"` values to display buckets
  (`Death`, `Major Injury`, `Minor Injury`, `None`) in its resolver layer — insert raw strings as-is
- **Materialized views:** `filter_metadata` and `available_years` must be refreshed after import
- **PostGIS:** Required for the `"geom"` column; already enabled on the Render database

CrashMap source: <https://github.com/nickmagruder/crashmap>
