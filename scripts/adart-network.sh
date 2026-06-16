#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${REPO_DIR:-$(cd -- "$SCRIPT_DIR/.." && pwd)}"
ENSURE_SCRIPT="${AGS_ENSURE_SCRIPT:-$SCRIPT_DIR/ags-ensure}"
INSTANCE="${AGS_INSTANCE:-adart}"
APP_PATH="${AGS_APP:-$REPO_DIR/src/app.ts}"

"$ENSURE_SCRIPT" "$INSTANCE" "$APP_PATH"

if [[ $# -gt 0 ]]; then
  ags request -i "$INSTANCE" networktoggle "$1"
else
  ags request -i "$INSTANCE" networktoggle
fi
