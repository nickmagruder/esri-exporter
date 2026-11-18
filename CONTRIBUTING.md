# Contributing

esri-exporter (the CrashMap Data Pipeline) is a personal project built in the
open. Issues, questions and suggestions are welcome; pull requests are welcome
too, but please open an issue first so we can agree on the change.

Some of the code is written by AI coding agents working to the same rules
below, and [`AGENTS.md`](AGENTS.md) holds the agent-facing version.

## How changes are made

- **Trunk-based.** `main` is always releasable and every merge deploys. Work
  happens on short-lived branches named for their issue (`fix/52-date-range`,
  `feat/`, `chore/`, `docs/`), merged by squash PR.
- **Every PR** links its issue (`Closes #52`), says how it was tested, and
  updates the docs it affects (README changelog and version, `ARCHITECTURE.md`,
  `TUTORIAL.md`, `AGENTS.md`).
- **CI must pass** (`check`: frontend lint, typecheck and build; backend ruff
  and unit tests; the commit-message rule tests). CodeQL scans every PR.
  Copilot reviews every PR; address or answer its comments before merging.
- **Commit messages:** imperative summary of 72 characters or fewer ("Add
  bulk import", not "Added…"), no trailing period, a blank line before the
  body; a body explains why when it isn't obvious; one logical change per
  commit. The commit-msg hook (`scripts/commit-msg.ts`) checks the summary.
- **Hooks:** run `npm install` at the repo root once to set them up. The
  pre-commit hook runs ESLint on staged frontend files, then a gitleaks secret
  scan (install it with `winget install Gitleaks.Gitleaks` or your package
  manager). Never skip them with `--no-verify`.
- **Versioning:** semver in the `**Version:**` line of `README.md`; every
  change gets a changelog entry (newest first). PATCH for fixes and docs,
  MINOR for new features (SQL generation, fetch, import), MAJOR for breaking
  changes to the API or pipeline.

## Coding standards

### Backend (Python)

- Python 3.14 (`backend/.python-version`), Flask; keep dependencies pinned
  in `requirements.txt` (test tools in `requirements-dev.txt`).
- `ruff check .` passes (`backend/ruff.toml`).
- Values reach generated SQL only through the quoting helpers in
  `generate_sql`; never format a value straight into SQL.
- Validate request input before using it; outbound requests go only to
  WSDOT, with a timeout.

### Frontend (TypeScript)

- React function components and hooks, TanStack Query for server state,
  Tailwind for styles.
- `strict` TypeScript; `npm run typecheck` (`tsc -b`) passes, since
  `npm run build` doesn't type-check.
- Accessible: labelled form controls, keyboard access, visible focus, and
  errors announced to screen readers (WCAG 2.1 AA).

### Tests

- `backend/test_json_fixer.py` (pytest) covers parsing and SQL generation;
  add tests with every change there.
- `backend/test_e2e.py` calls the live WSDOT API; run it by hand for changes
  to fetching or mapping.
- For refactors or dependency changes, compare generated SQL before and
  after (see "SQL guardrail" in `AGENTS.md`).

### Style

- Small functions with clear names; reuse existing helpers; no speculative
  abstractions. Comments explain why, not what. Dates are ISO `YYYY-MM-DD`.
