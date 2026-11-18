// Commit message rules (CONTRIBUTING.md), used by the commit-msg hook
// (`scripts/commit-msg.ts`). The imperative check is a best-effort heuristic:
// it catches the usual "Added" / "Adding" / "Adds" slips, not every one.

export const MAX_SUMMARY = 72

/** Summaries git or GitHub writes itself; not ours to police. */
const GENERATED =
  /^(Merge (pull request|branch|remote-tracking branch|tag|commit) |Revert "|fixup! |squash! |amend! )/

/** Real words ending in -ed/-ing that are fine as an imperative first word. */
const ED_ING_IMPERATIVES = new Set([
  'bleed',
  'breed',
  'bring',
  'embed',
  'exceed',
  'feed',
  'need',
  'ping',
  'proceed',
  'seed',
  'shed',
  'shred',
  'speed',
  'spring',
  'string',
  'succeed',
  'swing',
])

/** Imperatives ending in -s that aren't a third-person verb. */
const S_IMPERATIVES = new Set(['alias', 'canvas', 'focus', 'gas', 'harass', 'redress'])

/** True when the first word reads as past tense, a gerund or third person. */
function isNonImperative(word: string): boolean {
  if (/(ed|ing)$/.test(word)) return !ED_ING_IMPERATIVES.has(word)
  // Third person: "Adds", "Allows", "Fixes". Words ending in -ss, -us or -is
  // ("Pass", "Process", "Focus", "Emphasis") are left alone.
  if (/[^su]s$/.test(word) && !/is$/.test(word)) return !S_IMPERATIVES.has(word)
  return false
}

/** Drops git's comment lines and everything below the `--verbose` scissors line. */
export function stripComments(raw: string): string {
  const lines: string[] = []
  for (const line of raw.replace(/\r\n/g, '\n').split('\n')) {
    if (line.startsWith('# ------------------------ >8')) break
    if (!line.startsWith('#')) lines.push(line)
  }
  return lines.join('\n').trim()
}

/** Returns the rule violations in a commit message; empty when it passes. */
export function checkCommitMessage(raw: string): string[] {
  const message = stripComments(raw)
  if (message === '') return ['The commit message is empty.']

  const [summary = '', secondLine] = message.split('\n')
  if (GENERATED.test(summary)) return []

  const errors: string[] = []
  if (summary.length > MAX_SUMMARY) {
    errors.push(`Summary is ${summary.length} characters; keep it to ${MAX_SUMMARY} or fewer.`)
  }
  if (summary.endsWith('.')) errors.push('Summary ends with a period; drop it.')
  if (/^[a-z]/.test(summary)) errors.push('Summary starts with a lowercase letter; capitalise it.')

  const first = (summary.match(/^[A-Za-z]+/)?.[0] ?? '').toLowerCase()
  if (first !== '' && isNonImperative(first)) {
    errors.push(
      `Summary starts with "${first}"; use the imperative ("Add", "Fix", not "Added", "Adds", "Adding").`
    )
  }

  if (secondLine !== undefined && secondLine.trim() !== '') {
    errors.push('Leave a blank line between the summary and the body.')
  }
  return errors
}
