#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${REPO_DIR:-$(cd -- "$SCRIPT_DIR/.." && pwd)}"

if [ -n "${AGS_ENSURE_SCRIPT:-}" ]; then
  ENSURE_SCRIPT="$AGS_ENSURE_SCRIPT"
elif command -v ags-ensure >/dev/null 2>&1; then
  ENSURE_SCRIPT="$(command -v ags-ensure)"
else
  ENSURE_SCRIPT="$SCRIPT_DIR/ags-ensure"
fi

if [ ! -x "$ENSURE_SCRIPT" ]; then
  echo "Error: ensure script not found or not executable: $ENSURE_SCRIPT" >&2
  exit 2
fi

INSTANCE="${AGS_INSTANCE:-adart}"
APP_PATH="${AGS_APP:-$REPO_DIR/src/app.ts}"

"$ENSURE_SCRIPT" "$INSTANCE" "$APP_PATH"

if [[ $# -gt 0 ]]; then
  ags request -i "$INSTANCE" toggleDashboard "$1"
else
  ags request -i "$INSTANCE" toggleDashboard
fi
