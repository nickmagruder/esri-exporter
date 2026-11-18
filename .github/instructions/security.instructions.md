---
applyTo: 'backend/app.py,backend/requirements.txt,frontend/vite.config.ts,render.yaml,.github/workflows/**'
---

# Security-critical code

`backend/app.py` builds SQL that an operator runs against CrashMap's
production database and calls an external API on request. Review every
change here as a possible security regression.

- **SQL generation:** values reach the script only through `sql_str`
  (single quotes doubled), `sql_num` or the mapping helpers built on them.
  A new column or code path that formats a value straight into SQL is an
  injection bug, even though the source is WSDOT: the script runs with
  write access to production.
- **Input validation:** `mode` must be a known mode, dates must be
  `YYYYMMDD`, and `batch_size` an integer within a sane range before any of
  them reach the WSDOT request or the SQL.
- **Outbound requests:** only the WSDOT endpoint, always with a timeout; no
  user-controlled URL (no server-side request forgery).
- **Errors:** error responses don't echo stack traces or environment
  details; production runs under gunicorn with Flask debug off.
- **Secrets:** none belong in this repo. The pipeline never connects to a
  database.
- **Workflows:** least-privilege `permissions`, actions pinned by commit SHA,
  `persist-credentials: false` on checkout.
