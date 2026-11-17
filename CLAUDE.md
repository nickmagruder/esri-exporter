@AGENTS.md

# Claude Code notes

Everything shared lives in `AGENTS.md` (imported above). Only Claude-specific details go here.

- **Dev servers:** `.claude/launch.json` (gitignored) defines `backend` (Flask, :5000),
  `frontend` (Vite dev, :5173) and `frontend-preview` (`vite preview`, :4173) for the desktop
  app's browser preview.
- **Memory:** keep project context in `AGENTS.md` and the tracked docs, not in the auto-memory
  folder (`~/.claude/projects/.../memory/`), which only points back here.
