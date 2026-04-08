#!/usr/bin/env bash
# Proxy script to send OSD-related requests to the "adart" AGS instance.
# Example: adart-osd.sh osdVolume, adart-osd.sh osdBrightness, adart-osd.sh osdPlayer next
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "Usage: adart-osd.sh <command> [args...]" >&2
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${REPO_DIR:-$(cd -- "$SCRIPT_DIR/.." && pwd)}"
ENSURE_SCRIPT="${AGS_ENSURE_SCRIPT:-$SCRIPT_DIR/ags-ensure.sh}"
INSTANCE="${AGS_INSTANCE:-adart}"
APP_PATH="${AGS_APP:-$REPO_DIR/src/app.ts}"

# Ensure AGS instance is running
"$ENSURE_SCRIPT" "$INSTANCE" "$APP_PATH"

# Forward the subcommand and arguments as an AGS request
ags request -i "$INSTANCE" "$@"
