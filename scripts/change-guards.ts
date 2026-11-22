// CI change guards, run by the `check` job as `node scripts/change-guards.ts`.
// On a branch, fails when the branch adds a focused or skipped test, an
// eslint-disable comment or a TypeScript suppression comment, or removes test
// assertions on net, and warns when it changes more than SIZE_WARNING lines.
// A commit on the branch with a `Test-guard: <reason>` line turns the
// failures into warnings, for changes that really need one (say why in the PR
// too). On main it only warns: the PR was already gated and reviewed, and a
// failure there would block the deploy. Rules: change-guards-rules.ts.

import { execFileSync } from 'node:child_process'
import { checkDiff, OVERRIDE, SIZE_WARNING } from './change-guards-rules.ts'

const git = (...args: string[]) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

// On main (after a squash merge) compare with the previous commit; on a
// branch, with where it left main.
const branch = git('rev-parse', '--abbrev-ref', 'HEAD').trim()
const onMain = process.env.GITHUB_REF === 'refs/heads/main' || branch === 'main'
const base = onMain ? 'HEAD~1' : git('merge-base', 'origin/main', 'HEAD').trim()

const diff = git('diff', '--no-renames', '--unified=0', base, 'HEAD')
const messages = git('log', '--format=%B', `${base}..HEAD`)
const { problems, changedLines } = checkDiff(diff)

if (changedLines > SIZE_WARNING) {
  console.log(
    `::warning::This change touches ${changedLines} lines (over ${SIZE_WARNING}, not counting lockfiles and generated code). Split it if it divides cleanly.`
  )
}

if (problems.length === 0) {
  console.log(`change-guards: ok (${changedLines} changed lines)`)
  process.exit(0)
}

const lenient = onMain || OVERRIDE.test(messages)
for (const problem of problems) console.log(`::${lenient ? 'warning' : 'error'}::${problem}`)
if (lenient) {
  console.log(
    onMain
      ? 'change-guards: on main, problems are warnings (the PR was gated)'
      : 'change-guards: overridden by a `Test-guard:` commit trailer'
  )
  process.exit(0)
}
console.error(
  'change-guards: fix the problems above, or add a `Test-guard: <reason>` line to a commit message if the change really needs it.'
)
process.exit(1)
