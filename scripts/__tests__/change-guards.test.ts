// Tests for the CI change-guard rules. Canonical copy: clankers
// templates/change-guards/. Copy it verbatim; a repo that keeps tests
// elsewhere changes only the import path below.

import { describe, expect, it } from 'vitest'
import {
  checkDiff,
  DEFAULT_CONFIG,
  OVERRIDE,
  parseDiff,
  SIZE_WARNING,
} from '../change-guards-rules.ts'

/** A one-file unified diff with the given added and removed lines. */
function diffOf(path: string, added: string[], removed: string[] = []) {
  return [
    `diff --git a/${path} b/${path}`,
    `--- a/${path}`,
    `+++ b/${path}`,
    '@@ -1 +1 @@',
    ...removed.map((l) => `-${l}`),
    ...added.map((l) => `+${l}`),
  ].join('\n')
}

describe('checkDiff', () => {
  it('passes ordinary code and test changes', () => {
    const diff =
      diffOf('lib/x.ts', ['export const x = 1']) +
      '\n' +
      diffOf('lib/__tests__/x.test.ts', ["it('works', () => expect(x).toBe(1))"])
    expect(checkDiff(diff).problems).toEqual([])
  })

  it('flags focused and skipped tests', () => {
    for (const line of [
      "it.only('a', () => {})",
      "describe.skip('b', () => {})",
      "xit('c', () => {})",
    ]) {
      expect(checkDiff(diffOf('lib/__tests__/x.test.ts', [line])).problems).toHaveLength(1)
    }
  })

  it('ignores .skip outside test files', () => {
    expect(checkDiff(diffOf('lib/list.ts', ['const rest = list.skip(1)'])).problems).toEqual([])
  })

  it('flags eslint-disable and TypeScript suppressions anywhere in code', () => {
    expect(
      checkDiff(diffOf('components/A.tsx', ['// eslint-disable-next-line no-console'])).problems
    ).toHaveLength(1)
    expect(
      checkDiff(diffOf('lib/a.ts', ['// @ts-expect-error wrong types'])).problems
    ).toHaveLength(1)
    expect(checkDiff(diffOf('lib/a.ts', ['// @ts-ignore'])).problems).toHaveLength(1)
  })

  it('ignores Markdown that mentions the patterns', () => {
    expect(
      checkDiff(diffOf('AGENTS.md', ['Never add `it.only` or `@ts-ignore`.'])).problems
    ).toEqual([])
  })

  it('flags a net loss of assertions in a test file', () => {
    const diff = diffOf(
      'lib/__tests__/x.test.ts',
      ['expect(a).toBe(1)'],
      ['expect(a).toBe(1)', 'expect(b).toBe(2)']
    )
    expect(checkDiff(diff).problems).toEqual([
      'lib/__tests__/x.test.ts: removes 1 assertion(s) net',
    ])
  })

  it('allows moving or rewriting assertions without losing any', () => {
    const diff = diffOf('lib/__tests__/x.test.ts', ['expect(b).toEqual(2)'], ['expect(b).toBe(2)'])
    expect(checkDiff(diff).problems).toEqual([])
  })

  it('flags assertions lost by deleting a test file', () => {
    const diff = [
      'diff --git a/lib/__tests__/gone.test.ts b/lib/__tests__/gone.test.ts',
      'deleted file mode 100644',
      '--- a/lib/__tests__/gone.test.ts',
      '+++ /dev/null',
      '@@ -1,2 +0,0 @@',
      "-it('a', () => expect(1).toBe(1))",
      '-',
    ].join('\n')
    expect(checkDiff(diff).problems).toEqual([
      'lib/__tests__/gone.test.ts: removes 1 assertion(s) net',
    ])
  })

  it('counts changed lines without lockfiles or generated code', () => {
    const big = Array.from({ length: SIZE_WARNING + 1 }, (_, i) => `line ${i}`)
    expect(checkDiff(diffOf('package-lock.json', big)).changedLines).toBe(0)
    expect(checkDiff(diffOf('frontend/package-lock.json', big)).changedLines).toBe(0)
    expect(checkDiff(diffOf('lib/graphql/__generated__/types.ts', big)).changedLines).toBe(0)
    expect(checkDiff(diffOf('lib/big.ts', big)).changedLines).toBe(SIZE_WARNING + 1)
  })

  it('skips generated code, which carries its own suppressions', () => {
    expect(
      checkDiff(diffOf('lib/graphql/__generated__/types.ts', ['/* eslint-disable */'])).problems
    ).toEqual([])
  })

  it('treats hunk lines that look like headers as content', () => {
    // A removed `-- note` shows as `--- note`; an added `++ x` as `+++ x`.
    const diff = diffOf('lib/__tests__/x.test.ts', ['++ x', 'it.only("a", () => {})'], ['-- note'])
    expect(parseDiff(diff)).toEqual([
      {
        path: 'lib/__tests__/x.test.ts',
        added: ['++ x', 'it.only("a", () => {})'],
        removed: ['-- note'],
      },
    ])
    expect(checkDiff(diff).problems).toHaveLength(1)
  })

  it('leaves the guard files themselves alone, wherever they live', () => {
    for (const path of [
      'scripts/change-guards-rules.ts',
      'scripts/change-guards.config.ts',
      'scripts/__tests__/change-guards.test.ts',
      'tests/scripts/change-guards.test.ts',
    ]) {
      expect(checkDiff(diffOf(path, ['/it.only/', '// @ts-ignore'])).problems).toEqual([])
    }
  })
})

describe('checkDiff with a repo config', () => {
  const config = { generated: [/^lib\/generated\//], testDirs: ['tests', '__tests__'] }

  it('treats every file under a configured test folder as a test', () => {
    expect(
      checkDiff(diffOf('tests/x.ts', ["it.only('a', () => {})"]), config).problems
    ).toHaveLength(1)
    expect(checkDiff(diffOf('tests/x.ts', ["it.only('a', () => {})"])).problems).toEqual([])
  })

  it('skips the configured generated paths, and lockfiles always', () => {
    const big = Array.from({ length: 3 }, (_, i) => `line ${i}`)
    expect(checkDiff(diffOf('lib/generated/prisma.ts', big), config).changedLines).toBe(0)
    expect(checkDiff(diffOf('lib/generated/prisma.ts', big), DEFAULT_CONFIG).changedLines).toBe(3)
    expect(checkDiff(diffOf('uv.lock', big), config).changedLines).toBe(0)
  })

  it('allows a repo with no test folders', () => {
    const none = { generated: [], testDirs: [] }
    expect(checkDiff(diffOf('lib/x.ts', ["it.only('a', () => {})"]), none).problems).toEqual([])
    expect(
      checkDiff(diffOf('lib/x.test.ts', ["it.only('a', () => {})"]), none).problems
    ).toHaveLength(1)
  })
})

describe('checkDiff on Python', () => {
  it('flags skipped and expected-to-fail tests in pytest files', () => {
    for (const line of [
      '@pytest.mark.skip(reason="flaky")',
      '@pytest.mark.xfail',
      '    pytest.skip("later")',
      '@unittest.skip("later")',
    ]) {
      expect(checkDiff(diffOf('backend/test_app.py', [line])).problems).toHaveLength(1)
    }
  })

  it('flags noqa and type-ignore comments anywhere in Python code', () => {
    expect(checkDiff(diffOf('backend/app.py', ['import os  # noqa: F401'])).problems).toHaveLength(
      1
    )
    expect(checkDiff(diffOf('backend/app.py', ['x = f()  # type: ignore'])).problems).toHaveLength(
      1
    )
  })

  it('leaves ordinary Python alone, and JS rules off Python files', () => {
    expect(
      checkDiff(diffOf('backend/app.py', ['def skip(rows): return rows[1:]', '// eslint-disable']))
        .problems
    ).toEqual([])
  })

  it('flags a net loss of assert statements in a pytest file', () => {
    const diff = diffOf(
      'backend/test_app.py',
      ['    assert a == 1'],
      ['    assert a == 1', '    assert b == 2', '    self.assertEqual(c, 3)']
    )
    expect(checkDiff(diff).problems).toEqual(['backend/test_app.py: removes 2 assertion(s) net'])
  })

  it('does not count asserts in non-test Python files', () => {
    expect(checkDiff(diffOf('backend/app.py', [], ['    assert rows'])).problems).toEqual([])
  })
})

describe('parseDiff', () => {
  it('splits files and their added and removed lines', () => {
    const files = parseDiff(diffOf('a.ts', ['new'], ['old']))
    expect(files).toEqual([{ path: 'a.ts', added: ['new'], removed: ['old'] }])
  })
})

describe('OVERRIDE', () => {
  it('matches a Test-guard trailer with a reason only', () => {
    expect(OVERRIDE.test('Fix x\n\nTest-guard: the old test asserted a bug')).toBe(true)
    expect(OVERRIDE.test('Fix x\n\nTest-guard:')).toBe(false)
  })
})
