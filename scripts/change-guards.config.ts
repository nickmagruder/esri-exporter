// This repo's settings for the CI change guards (change-guards.ts). The other
// guard files are verbatim copies of clankers templates/change-guards/; this
// one is the repo's own. Lockfiles are always skipped.

import type { GuardConfig } from './change-guards-rules.ts'

export default {
  // Generated code, out of the rules and the size count.
  generated: [/(^|\/)__generated__\//],
  // Folders whose JS/TS files all count as tests, besides `*.test.*`/`*.spec.*`.
  testDirs: ['__tests__'],
} satisfies GuardConfig
