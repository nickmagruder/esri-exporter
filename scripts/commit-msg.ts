// commit-msg hook entry, run by husky as `node scripts/commit-msg.ts <file>`.
// Always runs (no "am I the main module" guard), so the check can't silently
// switch off; the rules live in commit-msg-rules.ts.

import { readFileSync } from 'node:fs'
import { checkCommitMessage } from './commit-msg-rules.ts'

const file = process.argv[2]
if (file === undefined) {
  console.error('usage: node scripts/commit-msg.ts <commit-message-file>')
  process.exit(2)
}

const errors = checkCommitMessage(readFileSync(file, 'utf8'))
if (errors.length > 0) {
  console.error('commit-msg: the message breaks the commit rules (CONTRIBUTING.md):')
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}
