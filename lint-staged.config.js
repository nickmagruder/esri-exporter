// Runs on staged files from the pre-commit hook. The frontend has its own
// ESLint install and config, so ESLint runs from frontend/.
const quote = (files) => files.map((f) => JSON.stringify(f)).join(' ')

export default {
  'frontend/**/*.{ts,tsx}': (files) => `npm --prefix frontend exec -- eslint --fix ${quote(files)}`,
}
