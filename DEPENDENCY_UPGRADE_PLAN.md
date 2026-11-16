# Dependency Upgrade Plan

> **Status:** Phases 0–3 implemented 2026-11-16 (v1.0.1, uncommitted). Phases 4–8 pending.
> **Open issue (not upgrade-related):** the WSDOT `CrashDataPortalService.svc/REST/GetPublicPortalData` endpoint returns HTTP 404 as of 2026-11-16 (plain `curl` too), so `test_e2e.py` fails 0/10 and the live fetch flow is down.
> **Prepared:** 2026-11-16
> **Baseline:** `main` @ `2ac5309`, README version **1.0.0**

This plan updates every dependency in the CrashMap Data Pipeline to its latest stable version, or explains why an upgrade should wait. It is split into small phases. Each phase is meant to be one commit made in GitHub Desktop.

---

## 1. Dependency inventory

| Source | What it pins |
| --- | --- |
| `backend/requirements.txt` | Flask, Flask-Cors, gunicorn, requests. Exact `==` pins. There are no test dependencies; the tests run with plain `python`. |
| `backend/venv` (local only) | **Python 3.14.0**. Werkzeug 3.1.3 is installed but not pinned (it is a transitive dependency). |
| `render.yaml` | `PYTHON_VERSION=3.11.6` for the API service. The static site has **no Node version pin**. Build commands: `pip install -r requirements.txt`, `npm install && npm run build`. Start command: `gunicorn --bind 0.0.0.0:$PORT app:app`. |
| `frontend/package.json` + `package-lock.json` | Caret ranges for every package. No `engines` field and no `lint` script. |
| `.python-version`, `.nvmrc`, `.node-version` | **None present.** |
| `frontend/eslint.config.js` | A flat config that imports **`globals`, `eslint-plugin-react-refresh` and `typescript-eslint`, none of which are installed** (see §3). |
| `frontend/postcss.config.js`, `tailwind.config.js`, `src/styles/global.css` | Tailwind 3 setup. Tailwind is wired through PostCSS. |
| `frontend/tsconfig*.json`, `vite.config.ts` | TypeScript 5.x bundler-mode config. Vite config holds only the React plugin and the `/api` proxy. |
| `netlify.toml`, `vercel.json` | Legacy hosting configs with no version pins. They are not used by Render. They inherit the same Node requirement if anyone deploys there. |

Local toolchain: Node **24.10.0**, npm 11.10.0.

---

## 2. Version table

Latest versions were checked on 2026-11-16 with `npm outdated`, `npm view`, `pip list --outdated` and the PyPI JSON API.

### Backend

| Package | Current | Latest | Bump | Risk | Notes |
| --- | --- | --- | --- | --- | --- |
| Python (Render) | 3.11.6 | 3.15.0 (3.14.x is the latest mature line) | minor ×4 | med | Local venv is already on 3.14.0, so dev and prod differ. Render's default for new services is 3.14.3. **Target 3.14.x. Defer 3.15** (see §6). |
| Flask | 2.3.2 | 3.1.3 | **major** | low | This app uses no APIs removed in 3.x. Needs Python ≥3.9 and Werkzeug ≥3.1. |
| Werkzeug (transitive) | 3.1.3 (unpinned) | 3.1.9 | patch | low | Recommend pinning it so local and Render installs match. |
| Flask-Cors | 3.0.10 | 6.0.5 | **major** ×3 | low | Only `CORS(app)` with defaults is used. The 5.0 and 6.0 changes (private-network default, path ordering) don't affect this app. 6.0 fixes CVE-2024-6866 and CVE-2024-6844. |
| gunicorn | 21.2.0 | 27.0.1 | **major** ×6 | med | Stricter HTTP parsing in 22, 23 and 27 (security fixes). The eventlet worker was removed in 26; this app uses the default sync worker. Needs Python ≥3.10. |
| requests | 2.32.3 | 2.34.2 | minor | low | Needs Python ≥3.10. |
| pytest (optional, new) | — | 9.2.0 | new | low | Optional `requirements-dev.txt`. The tests already run without it. |

### Frontend

| Package | Current (installed) | Latest | Bump | Risk | Notes |
| --- | --- | --- | --- | --- | --- |
| @tanstack/react-query | 5.90.21 | 5.107.1 | minor | low | Peer `react ^18 \|\| ^19`. |
| react / react-dom | 18.3.1 | 19.3.1 | **major** | low–med | Upgrade together with `@types/react` and `@types/react-dom`. |
| @types/react | 18.3.28 | 19.3.0 | **major** | low–med | Take 18.3.31 in Phase 1, then 19 in Phase 5. |
| @types/react-dom | 18.3.7 | 19.3.0 | **major** | low | Upgrade together with React 19. |
| vite | 6.4.1 | 8.3.8 | **major** ×2 | med | Node ^20.19 or ≥22.12. Vite 8 replaces Rollup and esbuild with Rolldown and Oxc. Take 6.4.6 in Phase 1. |
| @vitejs/plugin-react | 4.7.0 | 6.3.0 | **major** ×2 | med | v5 pairs with Vite 7 and v6 with Vite 8. v6 drops Babel. |
| tailwindcss | 3.4.19 | 4.3.5 | **major** | med | New CSS-first config. The PostCSS plugin moves to a separate package. See Phase 6. |
| postcss | 8.5.6 | 8.5.33 | patch | low | Can be removed if Phase 6 uses `@tailwindcss/vite`. |
| autoprefixer | 10.4.24 | 10.6.2 | minor | low | Tailwind 4 makes it redundant, so remove it in Phase 6. |
| typescript | 5.9.3 | **7.0.2** (6.0.3 on the 6.x line) | **major** | high (7) / low (6) | **Take 6.0.3. Defer 7**: typescript-eslint requires `typescript <6.1.0`, and TS 7.0 ships without a programmatic API. |
| eslint | 8.57.1 | 10.15.0 | **major** ×2 | med | ESLint 9 reached end of life on 2026-08-06, so go straight to 10. Needs Node ^20.19, ^22.13 or ≥24. |
| @eslint/js | 9.39.2 | 10.0.1 | **major** | low | Must match the ESLint major version. |
| eslint-plugin-react-hooks | 5.2.0 | 7.1.1 | **major** ×2 | low–med | v7 turns on React Compiler lint rules in `recommended`. |
| typescript-eslint | **missing** | 8.73.0 | new | low | Already imported by `eslint.config.js`. Peer: `eslint ^8 \|\| ^9 \|\| ^10`, `typescript <6.1.0`. |
| globals | **missing** | 17.14.0 | new | low | Already imported by `eslint.config.js`. |
| eslint-plugin-react-refresh | **missing** | 0.5.8 | new | low | Already imported by `eslint.config.js`. Peer: `eslint ^9 \|\| ^10`. |
| react-router-dom | 6.30.3 | 7.18.5 | major | — | **Unused. Remove it**: nothing imports it. |
| export-from-json | 1.7.4 | 1.8.2 | minor | — | **Unused. Remove it.** |
| json-to-csv-export | 3.1.3 | 3.1.3 | — | — | **Unused. Remove it.** |

### Runtimes on Render

| Runtime | Current | Target | Notes |
| --- | --- | --- | --- |
| Python | 3.11.6 (`PYTHON_VERSION`) | 3.14.x | Set in `render.yaml`. |
| Node (static site) | **Not pinned.** An existing service keeps the default from the date it was created, which could be older than 20.19. | 24.x (LTS; matches local 24.10) | Add `NODE_VERSION` to the static site in `render.yaml`, or add `frontend/.node-version`. Add `"engines": { "node": ">=20.19" }`. **This is a prerequisite for Vite 7/8 and ESLint 10.** |

---

## 3. Baseline problems found (fix before upgrading)

I ran the verification commands against the current `main`. Two of them **already fail**, so they can't yet tell us whether an upgrade broke something:

1. **`python test_json_fixer.py`: 7 passed, 3 failed.** The fixture `backend/seattle short.txt` (and `seattle.txt`) was deleted in commit `73e72bd` ("Initial database population"). CLAUDE.md and the tests still depend on it.
2. **ESLint can't run.** `npx eslint .` fails with a module-resolution error. `eslint.config.js` imports `globals`, `eslint-plugin-react-refresh` and `typescript-eslint`, none of which are in `package.json`. ESLint 8 is also paired with `@eslint/js` 9. `package.json` has **no `lint` script**, so `npm run lint` doesn't exist.
3. `npm run build` passes. `npx tsc -b` passes. Tailwind warns "No utility classes were detected". This is expected: the app uses only Tailwind's Preflight reset (`global.css`) and plain CSS classes in `form.styles.css`. **No Tailwind utility classes are used anywhere.**
4. `tailwind.config.js` uses CommonJS (`module.exports`, `require`) inside a `"type": "module"` package, and lists `tailwindcss` as a plugin of itself. Tailwind 3's loader tolerates this. The file is deleted in Phase 6.
5. `npm run build` doesn't type-check (`vite build` only). Typecheck is run separately with `npx tsc -b` in the verification steps.

---

## 4. Deprecated or removed API usage in this codebase

| Location | Usage | Affected by | Action |
| --- | --- | --- | --- |
| [backend/app.py:159](backend/app.py:159) | `datetime.utcnow()` (inside `generate_sql()` header) | Deprecated since Python 3.12. It emits a `DeprecationWarning` and still works on 3.14. | Optional: `datetime.now(timezone.utc)`. The `"%Y-%m-%d"` output is identical. |
| [backend/app.py:291](backend/app.py:291), [backend/app.py:381](backend/app.py:381) | `datetime.utcnow()` (download filenames) | Same as above | Same fix |
| [backend/app.py:188-190](backend/app.py:188) | `CORS(app)` inside bare `except:` | Flask-Cors 6: the call signature is unchanged | None required |
| [backend/app.py:294](backend/app.py:294), [backend/app.py:384](backend/app.py:384) | `app.make_response(sql)` + manual headers | Still supported in Flask 3.1 | None |
| [frontend/src/main.tsx:2](frontend/src/main.tsx:2) | `ReactDOM.createRoot` from `react-dom/client` | Still the React 19 API. The removed `ReactDOM.render` is **not** used. | None |
| [frontend/src/components/form.component.tsx:23](frontend/src/components/form.component.tsx:23) | `React.FC` | Still in `@types/react` 19, without implicit `children` (already the case in 18) | None |
| [frontend/src/components/form.component.tsx:85](frontend/src/components/form.component.tsx:85), [:93](frontend/src/components/form.component.tsx:93) | `React.FormEvent` | Present in `@types/react` 19 | Check `tsc` output only |
| [frontend/src/styles/global.css:1-3](frontend/src/styles/global.css:1) | `@tailwind base/components/utilities` | Removed in Tailwind 4 | Replace with `@import "tailwindcss";` (Phase 6) |
| [frontend/postcss.config.js:3](frontend/postcss.config.js:3) | `tailwindcss` as a PostCSS plugin | Moved to `@tailwindcss/postcss` in v4 | Phase 6 |
| [frontend/eslint.config.js:7](frontend/eslint.config.js:7) | `tseslint.config(...)` | Deprecated in typescript-eslint 8 in favor of ESLint's `defineConfig` | Phase 3 |
| [frontend/eslint.config.js:22](frontend/eslint.config.js:22) | `reactHooks.configs.recommended.rules` | react-hooks v7 restructured its presets | Phase 3 |

**Not used anywhere, so not affected:** `ReactDOM.render` and `hydrate`, string refs, `propTypes`/`defaultProps`, legacy context, `useRef()` without an argument, the global `JSX` namespace, Babel options in the Vite plugin, Sass, `splitVendorChunkPlugin`, `flask.Markup`/`escape`/`json_encoder`, `send_file(attachment_filename=…)`, `before_first_request`, gunicorn eventlet workers.

---

## 5. Phases

### Guardrail: the SQL output must not change

Do this before Phase 0 and repeat it after **every backend phase**. With the restored fixture:

```bash
cd backend
python -c "import json; from app import fix_malformed_json, generate_sql; r=json.loads(fix_malformed_json(open('seattle short.txt',encoding='utf-8').read())); open('../.sql-golden.sql','w',encoding='utf-8',newline='').write(generate_sql(r,'Bicyclist'))"
```

Keep the first output as the golden copy. After each phase, regenerate it and diff while ignoring the date line:

```bash
diff <(grep -v '^-- Generated:' .sql-golden.sql) <(grep -v '^-- Generated:' .sql-new.sql)
```

The diff must be empty. Don't commit these files. Add `.sql-*.sql` to `.gitignore`, or write them to a temp folder instead. `fix_malformed_json()` is not changed in any phase.

---

### Phase 0: Restore the baseline (prerequisite, docs/tests only)

- Restore the test fixtures from git history: `git checkout 73e72bd^ -- "backend/seattle short.txt" "backend/seattle.txt"`. Or restore only the short one if the large file was removed on purpose; the tests use only `seattle short.txt`.
- Confirm `python test_json_fixer.py` → 10 passed.
- Version: no bump (test fixture only).

### Phase 1: Safe patch and minor bumps

**1a. Backend** (`requirements.txt`)

```text
Flask==2.3.3          # last 2.3.x, stays on the 2.x line for now
Flask-Cors==3.0.10    # unchanged; major upgrade in Phase 4
gunicorn==21.2.0      # unchanged; major upgrade in Phase 4
requests==2.34.2
Werkzeug==3.1.9       # new explicit pin to stop dev/prod drift
```

Optional: add `backend/requirements-dev.txt` containing `-r requirements.txt` and `pytest==9.2.0`.

**1b. Frontend**

```bash
npm uninstall react-router-dom export-from-json json-to-csv-export
npm install @tanstack/react-query@^5.107.1
npm install -D vite@^6.4.6 postcss@^8.5.33 autoprefixer@^10.6.2 @types/react@^18.3.31
```

- Removing the three unused packages makes the bundle and the lockfile smaller. Nothing imports them.
- Version: **PATCH → 1.0.1**. Changelog: "Patch/minor dependency bumps; removed unused frontend packages; pinned Werkzeug."

### Phase 2: Pin runtimes on Render (config only)

- `render.yaml`, under the API service: `PYTHON_VERSION: "3.14.3"`, or the newest 3.14.x on Render at implementation time.
- `render.yaml`, under the static site: add

  ```yaml
  envVars:
    - key: NODE_VERSION
      value: "24"
  ```

  Alternatively, add a `frontend/.node-version` file containing `24`.
- `frontend/package.json`: add `"engines": { "node": ">=20.19" }`.
- Optional, in the same phase: replace `datetime.utcnow()` at [app.py:159](backend/app.py:159), [:291](backend/app.py:291), [:381](backend/app.py:381) with `datetime.now(timezone.utc)` and import `timezone`. This removes the 3.12+ DeprecationWarning. The output format is unchanged. Run the SQL guardrail diff.
- **Risk: medium.** It changes the production Python by 3 minor versions. Pure-Python dependencies all support 3.14, and local dev already runs on 3.14.0.
- **Rollback:** revert the `render.yaml` change and redeploy. The previous `PYTHON_VERSION` is restored on the next build. Render's "Rollback" on the previous deploy also works.
- Version: PATCH → 1.0.2.

### Phase 3: Repair and upgrade ESLint (8 → 10)

```bash
npm install -D eslint@^10.15.0 @eslint/js@^10.0.1 typescript-eslint@^8.73.0 \
  globals@^17.14.0 eslint-plugin-react-hooks@^7.1.1 eslint-plugin-react-refresh@^0.5.8
```

`package.json` scripts: add `"lint": "eslint ."`.

New `eslint.config.js`:

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
])
```

- **Expect new findings.** react-hooks v7 enables the React Compiler rules. A quick read of `form.component.tsx` found nothing that obviously breaks them: no effects, refs or render-time mutation. Fix any findings in this same phase.
- Must be done **before** Phase 7 (TypeScript), because typescript-eslint sets the TypeScript ceiling.
- **Risk: medium.** It only affects development; nothing is deployed.
- Version: PATCH.

### Phase 4: Backend major upgrades (Flask 3, Flask-Cors 6, gunicorn 27)

These are grouped into one commit because Flask 3.1 needs Werkzeug ≥3.1 and all three share the same smoke test. Split it into 4a (Flask + Flask-Cors) and 4b (gunicorn) if you want finer rollback.

```text
Flask==3.1.3
Werkzeug==3.1.9
Flask-Cors==6.0.5
gunicorn==27.0.1
requests==2.34.2
```

- **Flask 2.3 → 3.1:** The app uses only `Flask`, `jsonify`, `request`, `route`, `after_request`, `make_response` and `app.run`, all unchanged. Flask 3.0 removed `__version__`, `Markup`/`escape` re-exports, `JSONEncoder`/`json_encoder` and `send_file(attachment_filename=…)`. None of those are used. No code changes are expected.
- **Flask-Cors 3 → 6:** 4.0 dropped old Python versions. 5.0 turned off private-network access by default. 6.0 changed path-specificity ordering and path decoding (security fixes). The app calls `CORS(app)` with no `resources`, and in production the frontend reaches the API through a same-origin Render rewrite. No code changes are expected.
- **gunicorn 21 → 27:** 22 and 23 bring much stricter HTTP request parsing (request-smuggling fixes) and changes to forwarded-header handling. 26 removes eventlet. 27 tightens Transfer-Encoding handling and returns 414 for some over-long request lines. The start command `gunicorn --bind 0.0.0.0:$PORT app:app` uses the default sync worker and is still valid. **The only realistic risk is a proxy-related header change behind Render's load balancer.** Check it in the production smoke test.
- **Risk: medium**, mostly from gunicorn in production.
- **Rollback:** revert `requirements.txt` to the Phase 1 pins and redeploy, or use Render's Rollback to the previous deploy. There is no data or schema impact; the pipeline is stateless.
- Version: PATCH (no user-facing behavior change).

### Phase 5: React 19

```bash
npm install react@^19.3.1 react-dom@^19.3.1
npm install -D @types/react@^19.3.0 @types/react-dom@^19.3.0
npx types-react-codemod@latest preset-19 ./src   # expected to be a no-op
```

- No removed APIs are used (see §4). `@tanstack/react-query` 5.x supports React 19.
- StrictMode in 19 changes `useMemo`/`useCallback` double-invocation behavior. Neither hook is used here.
- **Risk: low–medium.** The code surface is small, but every component runs on the new renderer.
- **Rollback:** revert `package.json` and `package-lock.json` to the previous commit and run `npm ci`.
- Version: PATCH.

### Phase 6: Tailwind CSS 3 → 4

The app uses **only Preflight** and no utility classes, so the migration is mostly config work.

```bash
npm uninstall autoprefixer
npm install -D tailwindcss@^4.3.5 @tailwindcss/vite@^4.3.5
```

- `vite.config.ts`: `import tailwindcss from '@tailwindcss/vite'` → `plugins: [react(), tailwindcss()]`.
- `src/styles/global.css`: replace the three `@tailwind` lines with `@import "tailwindcss";`.
- **Delete** `tailwind.config.js`. v4 finds content automatically and there's no theme customization to carry over.
- **Delete** `postcss.config.js` and uninstall `postcss`, because nothing else uses PostCSS. Alternatively, keep PostCSS with `@tailwindcss/postcss` as the only plugin. The Vite plugin is the recommended route.
- Optionally run `npx @tailwindcss/upgrade` to cross-check.
- **Preflight changes that could affect the UI.** All are covered by explicit rules in `form.styles.css`:
  - `<button>` cursor becomes `default`. `.submit-button`, `.debug-toggle` and `.copy-button` set `cursor: pointer`, so no change.
  - Placeholder color becomes `currentColor` at 50% opacity. `.text-input::placeholder` sets `#999`, so no change.
  - Default border color becomes `currentColor`. Every bordered element here sets an explicit color.
- **Browser floor rises** to Safari 16.4+, Chrome 111+ and Firefox 128+. That is fine for an internal operator tool.
- Alternative worth considering: **drop Tailwind entirely**. It currently provides only a CSS reset. Removing it removes three dependencies and two config files, and you would add a small reset to `global.css`. This plan defaults to keeping Tailwind, as the stack in CLAUDE.md says.
- **Risk: medium.** It is a visual change only; the API isn't touched.
- **Rollback:** revert the commit. That restores the deleted config files and the v3 lockfile, then run `npm ci`.
- Version: PATCH.

### Phase 7: TypeScript 5.9 → 6.0

```bash
npm install -D typescript@~6.0.3
```

- TS 6.0 changes defaults: `strict` is on by default (already explicitly `true`), `types` defaults to `[]`, and some older targets and `moduleResolution: node10` are deprecated. Vite's types come in through `src/vite-env.d.ts` (`/// <reference types="vite/client" />`), which doesn't depend on `types`. `tsconfig.node.json` only includes `vite.config.ts`, which uses no Node globals. **No tsconfig changes are expected.** If `tsc -b` reports anything, it will most likely be a missing ambient type, fixed with `"types": ["vite/client"]` in `tsconfig.app.json`.
- Use `~6.0.3`, not `^6`, because typescript-eslint's peer range is `<6.1.0`.
- **Risk: low.**
- Version: PATCH.

### Phase 8: Vite 6 → 7 → 8 with @vitejs/plugin-react 4 → 5 → 6

This requires Phase 2, because Node must be ^20.19 or ≥22.12 on Render. Do it as two commits so a failure points to one bundler change.

**8a. Vite 7**

```bash
npm install -D vite@^7.3.8 @vitejs/plugin-react@^5.2.0
```

Vite 7 changes the default build target to `baseline-widely-available` and removes the Sass legacy API and `splitVendorChunkPlugin`. Neither is used. `vite.config.ts` doesn't change.

**8b. Vite 8**

```bash
npm install -D vite@^8.3.8 @vitejs/plugin-react@^6.3.0
```

- Vite 8 replaces Rollup and esbuild with **Rolldown and Oxc**. plugin-react 6 uses Oxc for React Refresh and **no longer depends on Babel**. This config passes no Babel options and doesn't use React Compiler, so its optional peer dependencies (`@rolldown/plugin-babel`, `babel-plugin-react-compiler`, `oxc-transform-react`) are not needed. npm may print optional-peer notices.
- `server.proxy` (`/api` → `localhost:5000`, `changeOrigin`) is unchanged in Vite 8.
- Expect small differences in output hashes and chunking. Compare `dist/` sizes before and after.
- **Risk: medium–high.** It replaces the whole bundler and affects both dev and production builds.
- **Rollback:** revert to the 8a commit, which leaves you on Vite 7 and is a fully working state. Then run `npm ci` and redeploy.
- Version: PATCH.

### After all phases

- README: bump to **1.1.0 only if user-facing behavior changed**. Nothing in this plan changes behavior, so stay on PATCH, at **1.0.x** with x incremented per committed phase. You could also do a single **1.0.1** if all phases ship together.
- Changelog: add one dated bullet per phase.
- Update the Stack table in CLAUDE.md, the Python version in ARCHITECTURE.md, and the "Python 3.11 + Flask 2.3" line in the memory notes and docs.

---

## 6. Verification steps (run for every phase)

**Backend** (run in `backend/` with the venv active):

1. `pip install -r requirements.txt`, then `pip check` (should report no broken requirements).
2. `python test_json_fixer.py`: **10 passed** (needs Phase 0). `pytest` works too if it is installed.
3. `python test_e2e.py`: all 10 pass. This **hits the live WSDOT API**, so it may fail for network reasons that aren't regressions. Re-run before blaming the upgrade.
4. `python app.py`: starts cleanly on :5000, with no tracebacks or DeprecationWarnings. Then `curl http://localhost:5000/api` returns the welcome JSON.
5. The SQL guardrail diff above is empty.
6. Gunicorn phases only: `gunicorn --bind 127.0.0.1:8000 app:app` (WSL or Render; gunicorn doesn't run natively on Windows), then `curl -X POST localhost:8000/api/fetch-and-generate-sql -H 'Content-Type: application/json' -d '{"mode":"Pedestrian","start_date":"20250101","end_date":"20250131"}' -o test.sql`.

**Frontend** (run in `frontend/`):

1. `npm ci` (succeeds with no ERESOLVE), then `npm ls` (no `invalid` or `missing` entries).
2. `npm run build`: succeeds.
3. `npx tsc -b`: no errors. This is the only type check; `vite build` doesn't type-check.
4. `npm run lint`: no errors (from Phase 3 on).
5. `npm run dev` with `python app.py` running. In the browser: Mode = Pedestrian, a one-month date range, then **Fetch from WSDOT & Download SQL** → a `crashmap_pedestrian_YYYYMMDD_YYYYMMDD.sql` file downloads and the success message shows. Repeat for Bicyclist. Open **Debug: Fix Raw JSON**, paste a sample, and check that **Fix JSON** works. This confirms the `/api` proxy.
6. Phases 6 and 8: compare the page visually with a screenshot taken before the upgrade.

**Render** (after pushing each phase that touches runtime or build):

1. API service build log: `pip install` succeeds with the expected Python version, and gunicorn boots with no worker errors.
2. Static site build log: the expected Node version is printed, and `npm install && npm run build` succeeds.
3. Production smoke test: run the same fetch → download flow on the deployed site, through the dashboard `/api/*` rewrite, for both modes.
4. Spot-check the downloaded `.sql` header and a few INSERT rows: `ON CONFLICT ("ColliRptNum") DO NOTHING`, quoted PascalCase columns, no `"geom"`.

---

## 7. Peer dependencies and packages that must move together

- **eslint + @eslint/js**: same major version.
- **eslint-plugin-react-refresh 0.5** needs ESLint ≥9. **ESLint 10** needs Node ≥20.19.
- **typescript-eslint 8.73** caps **TypeScript at <6.1.0**. This is what blocks TS 7.
- **react + react-dom + @types/react + @types/react-dom**: same major version, in one commit.
- **vite + @vitejs/plugin-react**: Vite 7 ↔ plugin-react 5; Vite 8 ↔ plugin-react 6. `@tailwindcss/vite` 4.3 supports Vite 5–8, so Phases 6 and 8 can go in either order.
- **Flask 3.1 + Werkzeug ≥3.1**: pin both.
- **gunicorn 27, requests 2.34, pytest 9**: need Python ≥3.10. They're fine on 3.11 already and on 3.14 after Phase 2.
- **Vite 7/8 + ESLint 10** need Node ≥20.19 on Render, so **Phase 2 comes before Phases 3 and 8 are deployed**. (ESLint isn't run in the Render build, but `npm install` would warn on `engines`.)

---

## 8. Deferrals

| Upgrade | Recommendation | Why |
| --- | --- | --- |
| **TypeScript 7.0** | **Defer** to a later 7.x release (expected 7.1+) | typescript-eslint's peer range is `typescript <6.1.0`, and TS 7.0 ships no programmatic compiler API, so typescript-eslint cannot run on it yet. Revisit when typescript-eslint publishes TS 7 support. |
| **Python 3.15** | **Defer**, target 3.14.x now | 3.15.0 came out on 2026-10-09, about 5 weeks ago. 3.14 is Render's default and what local dev already uses. Revisit after 3.15.2 or 3.15.3. |
| **react-router-dom 7** | **Don't upgrade. Remove it.** | Nothing uses it. |
| Tailwind 4 | Proceed, but consider **dropping Tailwind** instead | It is used only as a CSS reset (see Phase 6). |
| Everything else | Proceed | |

---

## 9. Highest-risk items

1. **Vite 8 / plugin-react 6 (Phase 8b).** The whole bundler changes, in both dev and production. Doing Vite 7 first as its own commit gives a safe rollback point.
2. **gunicorn 21 → 27 (Phase 4).** Six majors of stricter HTTP parsing behind Render's proxy. It can't be fully tested on Windows, so the production smoke test is what decides.
3. **Python 3.11 → 3.14 on Render (Phase 2).** It is a big jump, but local dev already runs on 3.14, so the risk is mostly about Render's build.
4. **Unpinned Node on Render.** This is a hidden prerequisite. Without pinning it, Phases 3 and 8 may fail on Render even if they pass locally.
5. **Two baseline problems** (missing test fixture, ESLint that can't run) have to be fixed first, or the verification steps can't catch regressions.
