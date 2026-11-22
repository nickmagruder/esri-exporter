Closes #

## What and why

## How tested

- [ ] Frontend: `npm run lint`, `npm run knip`, `npm run typecheck`, `npm run build` (in `frontend/`)
- [ ] Backend: `ruff check .` and `pytest test_json_fixer.py` (in `backend/`)
- [ ] Repo: `npm test` and `npm run guards` (at the root)
- [ ] Tests changed? Why:
- [ ] SQL changes: generated SQL compared before and after (AGENTS.md "SQL guardrail"); `test_e2e.py` run against live WSDOT

## Docs

- [ ] README changelog entry (newest first) and version bump
- [ ] `ARCHITECTURE.md`, `TUTORIAL.md` or `AGENTS.md`, where affected

## After merge

Merging deploys both Render services (API and static site).
