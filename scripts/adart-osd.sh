#!/usr/bin/env bash
# Proxy script to send OSD-related requests to the "adart" AGS instance.
# Example: adart-osd.sh osdVolume, adart-osd.sh osdBrightness, adart-osd.sh osdPlayer next
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "Usage: adart-osd.sh <command> [args...]" >&2
  exit 1
fi

REPO_DIR="${REPO_DIR:-$HOME/Development/Hyprland/ags}"
INSTANCE="adart"
APP="$REPO_DIR/src/app.ts"

# Ensure AGS instance is running
ags-ensure.sh "$INSTANCE" "$APP"

# Forward the subcommand and arguments as an AGS request
ags request --instance "$INSTANCE" "$@"
