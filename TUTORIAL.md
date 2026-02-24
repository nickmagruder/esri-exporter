# CrashMap Data Pipeline — Operator Tutorial

> This guide walks through the complete process of downloading crash data from the WSDOT
> portal, generating SQL with the CrashMap Data Pipeline, and importing it into CrashMap's
> database.

---

## Overview

The full workflow has four stages:

1. **Fetch** — The pipeline calls the WSDOT API directly; you select mode and date range in the UI
2. **Generate** — The pipeline converts the response to SQL and offers a `.sql` file download
3. **Import** — Run the `.sql` file against CrashMap's PostgreSQL database
4. **Refresh** — Refresh CrashMap's materialized views so new data appears in the app

> **Important — always import Pedestrian data first, then Bicyclist.**
> Some crashes appear in both reports. The pipeline uses `ON CONFLICT DO NOTHING`, so
> whichever report is imported first "wins." Pedestrian is the canonical record for shared
> crashes.

---

## Stage 1: Fetch Data from WSDOT

The pipeline calls the WSDOT REST API directly from the backend — no browser export,
no copy-paste required.

### 1.1 Open the CrashMap Data Pipeline

Navigate to the deployed pipeline app (Render URL) or run it locally:

```bash
# Local development
cd backend && python app.py
# In another terminal:
cd frontend && npm run dev
# Open http://localhost:5173
```

### 1.2 Select the mode

In the **Mode** dropdown, select:

- `Pedestrian` — fetches "Pedestrians by Injury Type"
- `Bicyclist` — fetches "Bicyclists by Injury Type"

> **Double-check the mode.** Every record in the `.sql` file is stamped with the selected
> mode. Fetching bicyclist data while `Pedestrian` is selected will mislabel all records.

### 1.3 Set the date range

Enter a **Start Date** and **End Date**. The WSDOT tool goes back 10 years.

For the initial 10-year backfill, run the import separately for each year range you need.
A **Bulk Import** mode with a year-range selector is planned for Phase 4 — it will loop
through each year automatically and generate a single combined `.sql` file.

> **Tip:** For the initial backfill, run Pedestrian for all 10 years first, then Bicyclist.

### 1.4 Generate and download

Click **Fetch from WSDOT & Download SQL**. The backend will:

1. Call the WSDOT API for the selected mode and date range
2. Decode the double-encoded JSON response
3. Map all fields to CrashMap's schema
4. Generate batched `INSERT ... ON CONFLICT DO NOTHING` statements
5. Return a `.sql` file download

The `.sql` file downloads automatically to your browser's default download folder.
The filename follows the pattern `crashmap_<mode>_<startdate>_<enddate>.sql`
(e.g. `crashmap_pedestrian_20250101_20251231.sql`).

> **Note:** SQL preview and record count display are planned for a future release.

### 1.5 Repeat for the other mode

Run the full workflow a second time with the other mode selected.

Always import the Pedestrian `.sql` file before the Bicyclist `.sql` file.

---

### Fallback: Manual Copy from DevTools

If the direct API fetch is unavailable (network restrictions, API changes, testing), you
can manually copy the response from the browser and paste it into the pipeline.

1. Open the WSDOT portal in a browser
2. Open **DevTools** → **Network** tab
3. Apply your filters (date range, report type) and trigger the data load
4. Find the `GetPublicPortalData` request in the Network tab
5. Click it → **Response** tab → select all → copy
6. In the pipeline, expand the **Debug: Fix Raw JSON** section and paste the response
   to confirm the JSON parses correctly
7. A **Paste / Upload** tab for generating SQL from a pasted response is planned for a
   future release; in the meantime, use `POST /api/generate-sql` directly via `curl` or
   a tool like Insomnia/Postman

The raw response is a single line of double-encoded JSON — this is expected.

---

## Stage 2: Generate SQL

Stage 2 is handled automatically inside Stage 1. When you click **Fetch from WSDOT &
Download SQL**, the backend fetches the data, decodes the JSON, maps the fields, and
streams the resulting `.sql` file back to your browser as an automatic download.

There is no separate "generate" step — the download is the output of the fetch.

---

## Stage 3: Import into CrashMap's Database

### 3.1 Get the database connection string

The `DATABASE_URL` for CrashMap's Render PostgreSQL is stored in the Render dashboard
environment variables. It looks like:

```text
postgresql://user:password@hostname.render.com:5432/dbname?sslmode=require
```

> **Never commit this value to git.** Copy it temporarily into your terminal session only.

### 3.2 Run the SQL file

#### Option A — `psql` (command line)

```bash
psql "$DATABASE_URL" -f crashmap_import_2026-02-24.sql
```

You should see output like:

```text
INSERT 0 500
INSERT 0 500
INSERT 0 432
```

Each line corresponds to one batch. The number after `INSERT 0` is the rows inserted
(not skipped by `ON CONFLICT`). A count of `0` on re-import is normal and expected.

#### Option B — GUI tool (pgAdmin, TablePlus, DBeaver)

1. Connect to the Render database using the connection string
2. Open a Query window
3. Open or paste the `.sql` file contents
4. Execute

### 3.3 Verify the import

Run a quick check to confirm records were inserted:

```sql
SELECT "Mode", EXTRACT(YEAR FROM "CrashDate") AS year, COUNT(*)
FROM crashdata
GROUP BY "Mode", year
ORDER BY year DESC, "Mode";
```

Expected: new rows visible for the mode and year(s) you imported.

Also spot-check a specific record from your source data:

```sql
SELECT * FROM crashdata WHERE "ColliRptNum" = '3838031';
```

---

## Stage 4: Refresh CrashMap Materialized Views

CrashMap's filter dropdowns (counties, cities, years) are populated from two materialized
views. **These must be refreshed manually after every import.** Until you refresh them,
new records will appear on the map but may not show in filters.

### 4.1 Run the refresh

```sql
REFRESH MATERIALIZED VIEW filter_metadata;
REFRESH MATERIALIZED VIEW available_years;
```

Run these in the same `psql` session or GUI tool used in Stage 3.

### 4.2 Verify the refresh

```sql
-- Check that new counties/cities appear
SELECT DISTINCT county FROM filter_metadata ORDER BY county;

-- Check that new years appear
SELECT year FROM available_years ORDER BY year DESC;
```

### 4.3 Check the CrashMap app

Open CrashMap and verify:

- New records appear as dots on the map
- Year filter includes newly imported year(s)
- County and city filters include newly imported locations

---

## Full Import Checklist

Use this checklist each time you import new data.

### Pedestrian Import

- [ ] Open CrashMap Data Pipeline
- [ ] Set Mode = `Pedestrian`
- [ ] Set date range (e.g. `20250101` – `20251231`; or use Bulk Import for multi-year)
- [ ] Click **Fetch from WSDOT & Download SQL** — file downloads automatically
- [ ] Run `.sql` against Render PostgreSQL: `psql "$DATABASE_URL" -f <file>.sql`
- [ ] Confirm insert counts in psql output
- [ ] Spot-check a record in the database

### Bicyclist Import (run after Pedestrian)

- [ ] Open CrashMap Data Pipeline
- [ ] Set Mode = `Bicyclist`
- [ ] Set same date range as Pedestrian import
- [ ] Click **Fetch from WSDOT & Download SQL** — file downloads automatically
- [ ] Run `.sql` against Render PostgreSQL: `psql "$DATABASE_URL" -f <file>.sql`
- [ ] Confirm insert counts (some `0` rows expected for cross-report duplicates)

### After Both Imports

- [ ] `REFRESH MATERIALIZED VIEW filter_metadata;`
- [ ] `REFRESH MATERIALIZED VIEW available_years;`
- [ ] Verify new records visible in CrashMap app
- [ ] Verify year and location filters updated

---

## Troubleshooting

### "Failed to parse JSON" or "WSDOT API request failed" error

**Direct fetch path:** The WSDOT API may be temporarily unavailable or the date range
may have returned an empty response. Try a narrower date range, or wait and retry.
Use the DevTools fallback (see Stage 1) if the API is consistently unreachable.

**Fallback paste/upload path:** The pasted or uploaded content may be incomplete.
Copy the full response again from the DevTools Network tab — ensure you selected all
text in the Response panel. Do not open or edit the file in a text editor, as some
editors reformat or trim content.

### psql: SSL connection required

Add `?sslmode=require` to your connection string if it's not already present. Render
requires SSL for all external connections.

### psql: permission denied for table crashdata

You are connecting with the wrong database user or to the wrong database. Check the
`DATABASE_URL` in the Render dashboard.

### Records imported but don't appear on the map

The materialized views need refreshing. Run:

```sql
REFRESH MATERIALIZED VIEW filter_metadata;
REFRESH MATERIALIZED VIEW available_years;
```

Then hard-refresh the CrashMap browser tab (`Ctrl+Shift+R` / `Cmd+Shift+R`).

### Duplicate records (same crash in both ped and bike reports)

This is expected behavior, not an error. The pipeline uses `ON CONFLICT DO NOTHING` to
handle this silently. As long as the pedestrian import ran first, the duplicate will be
stored as a pedestrian record and the bicyclist insert will be skipped. You may see
`INSERT 0 N` lines in the psql output where `N` is less than the batch size — this is normal.

### Wrong mode selected for a file

If you realize you imported a bicyclist file as "Pedestrian" (or vice versa), the
affected records must be updated manually:

```sql
-- Fix mode for specific collision report numbers
UPDATE crashdata
SET "Mode" = 'Bicyclist'
WHERE "ColliRptNum" IN ('3838031', '3887523', ...);
```

Or, if the entire import needs to be redone, delete the affected records and re-import
with the correct mode:

```sql
-- Remove all records from a specific import date range with wrong mode
DELETE FROM crashdata
WHERE "Mode" = 'Pedestrian'
  AND "CrashDate" BETWEEN '2025-01-01' AND '2025-12-31'
  AND "ColliRptNum" IN (<list of affected ColliRptNums>);
```

Then refresh the materialized views and re-import with the correct mode.

---

## Local Development Setup

To run the pipeline locally:

```bash
# 1. Clone the repo
git clone https://github.com/nickmagruder/esri-exporter.git
cd esri-exporter

# 2. Backend
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py              # Runs on http://localhost:5000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev                # Runs on http://localhost:5173
```

The Vite dev server proxies `/api/*` requests to the Flask backend automatically.

To verify the local setup: select Mode = `Bicyclist`, set a date range, and click
**Fetch from WSDOT & Download SQL**. Confirm a `.sql` file downloads and the INSERT
statements match the field mapping in `ARCHITECTURE.md`.
