# Copilot instructions for esri-exporter

esri-exporter (the CrashMap Data Pipeline) fetches Washington State
pedestrian and bicyclist crash records from the public WSDOT collision API
and turns them into a `.sql` file that the operator runs against CrashMap's
PostgreSQL database. Backend: Python 3.14 + Flask (`backend/app.py`).
Frontend: React 19 + TypeScript + Vite + Tailwind (`frontend/`). Merging to
`main` deploys both Render services.

Project context: `AGENTS.md`. Coding standards: `CONTRIBUTING.md`. Field
mapping, SQL strategy and deployment: `ARCHITECTURE.md`. Operator runbook:
`TUTORIAL.md`.

## Reviewing pull requests

Use the `code-review` skill in `.github/skills/code-review/`. Review in this
order and rank findings most severe first:

1. **Generated SQL:** this is the riskiest output, because an operator runs
   it against the production database. Check quoting, NULL coercion, the
   WSDOT → CrashMap field mapping, batching, and the guarded upsert (a
   Bicyclist row never overwrites a Pedestrian one; `geom` is never inserted).
2. **Correctness:** WSDOT response parsing (`fix_malformed_json`), date
   handling (`YYYYMMDD` in, ISO dates out), error responses and status codes,
   frontend validation and download flow.
3. **Security:** see the rules below.
4. **Tests:** SQL and parsing changes come with `test_json_fixer.py` tests;
   behaviour that depends on live WSDOT data belongs in `test_e2e.py`.
5. **Simplicity:** dead code, duplication, needless abstraction.
6. **Docs:** README changelog entry (newest first) and version bump;
   `ARCHITECTURE.md`, `TUTORIAL.md` and `AGENTS.md` where behaviour changes.

For each finding give the file and line, the problem, a concrete failure
scenario and a suggested fix. Skip style nits that ESLint or ruff already
catch. If nothing significant turns up, say so.

## Rules the code must keep

- Every value from WSDOT goes into SQL through `sql_str`, `sql_num` or the
  mapping helpers, never by string formatting; the output stays a portable,
  re-runnable script (`ON CONFLICT ("ColliRptNum") ...`).
- The pipeline never connects to a database and holds no credentials; no
  database URL or secret belongs in code, config or logs.
- WSDOT requests go only to the configured WSDOT endpoint, with a timeout;
  user input (mode, dates, batch size) is validated before it reaches the
  request or the SQL.
- Import order: Pedestrian before Bicyclist when the ranges overlap.
- `npm run build` does not type-check: the frontend must also pass
  `npm run typecheck` (`tsc -b`).
- `render.yaml` is reference only; the live services are configured in the
  Render dashboard.
