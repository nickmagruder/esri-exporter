#!/bin/sh
# Blocks commits whose staged changes contain secrets. Run by .husky/pre-commit.

if command -v gitleaks >/dev/null 2>&1; then
  GITLEAKS=gitleaks
else
  # winget installs outside PATH until a new shell starts.
  GITLEAKS=$(ls "$LOCALAPPDATA"/Microsoft/WinGet/Packages/Gitleaks.Gitleaks_*/gitleaks.exe 2>/dev/null | head -n 1)
fi

if [ -z "$GITLEAKS" ]; then
  echo "pre-commit: gitleaks not found. Install it: winget install Gitleaks.Gitleaks" >&2
  exit 1
fi

exec "$GITLEAKS" git --pre-commit --staged --redact --no-banner
