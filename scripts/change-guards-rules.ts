// Rules for the CI change guards (`scripts/change-guards.ts`): patterns that
// let a change pass without being right, and a soft PR-size limit. Covers the
// TypeScript frontend and the Python backend (pytest skips, noqa, asserts).
// Pure functions over a unified diff, so they're unit-tested.

/** Changed lines above this get a CI warning (never a failure). */
export const SIZE_WARNING = 400

/** Paths the guards skip entirely: lockfiles and generated code. */
const GENERATED = [/(^|\/)package-lock\.json$/, /(^|\/)__generated__\//]

/** The guard's own files, which name the patterns they look for. */
const SELF = [
  /^scripts\/change-guards(-rules)?\.ts$/,
  /^scripts\/__tests__\/change-guards\.test\.ts$/,
]

const JS_CODE = /\.(ts|tsx|js|jsx|mjs|cjs)$/
const PY_CODE = /\.py$/
/** A test file: anything under a `__tests__/` folder, a `*.test`/`*.spec` file, or a pytest file. */
const IN_TESTS_DIR = /(?:^|\/)__tests__\//
const TEST_NAME = /\.(?:test|spec)\.[jt]sx?$/
const PY_TEST_NAME = /(?:^|\/)(?:test_[^/]*|[^/]*_test)\.py$/

/** Escape hatch: a commit on the branch with `Test-guard: <reason>`. */
export const OVERRIDE = /^Test-guard:\s*\S/m

type Rule = { name: string; pattern: RegExp; tests: boolean; python: boolean }

const RULES: Rule[] = [
  {
    name: 'focused or skipped test',
    pattern: /\b(describe|it|test|suite)\.(only|skip)\b|\b(xit|xdescribe|fit|fdescribe)\(/,
    tests: true,
    python: false,
  },
  { name: 'eslint-disable comment', pattern: /eslint-disable/, tests: false, python: false },
  {
    name: 'TypeScript suppression',
    pattern: /@ts-(ignore|expect-error|nocheck)\b/,
    tests: false,
    python: false,
  },
  {
    name: 'skipped or expected-to-fail test',
    pattern: /\bpytest\.(mark\.(skip|skipif|xfail)\b|skip\(|xfail\()|\bunittest\.skip|@skip\b/,
    tests: true,
    python: true,
  },
  { name: 'ruff/flake8 suppression', pattern: /#\s*noqa\b/, tests: false, python: true },
  { name: 'type-checker suppression', pattern: /#\s*(type|pyright):\s*ignore\b/, tests: false, python: true },
]

export type FileDiff = { path: string; added: string[]; removed: string[] }

/**
 * Splits a `git diff --no-renames` into files. `---`/`+++` lines count as
 * headers only between `diff --git` and the first `@@`, so content lines such
 * as a removed `-- comment` (shown as `--- comment`) stay content. A deleted
 * file (`+++ /dev/null`) keeps its old path and its removed lines.
 */
export function parseDiff(diff: string): FileDiff[] {
  const files: FileDiff[] = []
  let current: FileDiff | null = null
  let inHeader = false
  let oldPath = ''
  let newPath = ''
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {
      current = null
      inHeader = true
      oldPath = newPath = ''
      continue
    }
    if (inHeader) {
      if (line.startsWith('--- ')) oldPath = line.slice(4).replace(/^a\//, '')
      else if (line.startsWith('+++ ')) newPath = line.slice(4).replace(/^b\//, '')
      else if (line.startsWith('@@')) {
        inHeader = false
        current = { path: newPath === '/dev/null' ? oldPath : newPath, added: [], removed: [] }
        files.push(current)
      }
      continue
    }
    if (!current || line.startsWith('@@')) continue
    if (line.startsWith('+')) current.added.push(line.slice(1))
    else if (line.startsWith('-')) current.removed.push(line.slice(1))
  }
  return files
}

/** JS: `expect(`/`assert(` calls. Python: `assert` statements and unittest `self.assert*(`. */
const JS_ASSERTION = /\b(expect|assert)(\.\w+)?\(/g
const PY_ASSERTION = /^\s*assert\b|\bself\.assert\w*\(/g

const countAssertions = (lines: string[], pattern: RegExp) =>
  lines.reduce((n, l) => n + (l.match(pattern) ?? []).length, 0)

export type GuardResult = { problems: string[]; changedLines: number }

/** Checks a diff for weakened tests and suppressions, and counts its size. */
export function checkDiff(diff: string): GuardResult {
  const problems: string[] = []
  let changedLines = 0
  for (const file of parseDiff(diff)) {
    // Generated code carries its own suppressions (codegen's
    // `/* eslint-disable */`), so it's out of the rules and the size count.
    if (GENERATED.some((g) => g.test(file.path))) continue
    changedLines += file.added.length + file.removed.length
    if (SELF.some((s) => s.test(file.path))) continue
    const python = PY_CODE.test(file.path)
    if (!python && !JS_CODE.test(file.path)) continue
    const isTest = python
      ? PY_TEST_NAME.test(file.path)
      : IN_TESTS_DIR.test(file.path) || TEST_NAME.test(file.path)
    for (const rule of RULES) {
      if (rule.python !== python || (rule.tests && !isTest)) continue
      for (const line of file.added) {
        if (rule.pattern.test(line))
          problems.push(`${file.path}: adds a ${rule.name}: ${line.trim()}`)
      }
    }
    if (isTest) {
      const pattern = python ? PY_ASSERTION : JS_ASSERTION
      const lost = countAssertions(file.removed, pattern) - countAssertions(file.added, pattern)
      if (lost > 0) problems.push(`${file.path}: removes ${lost} assertion(s) net`)
    }
  }
  return { problems, changedLines }
}
