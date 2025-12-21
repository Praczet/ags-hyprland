#!/usr/bin/env bash
# Ensure an AGS instance is running for a given entrypoint.
# Usage: ags-ensure.sh [instance-name] [app-path]
# Defaults: instance "adart", app "$REPO_DIR/src/app.ts".
# Set REPO_DIR to where you cloned this repo, e.g. "$HOME/Development/Hyprland/ags".
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/Development/Hyprland/ags}"
INSTANCE="${1:-adart}"
APP_PATH="${2:-$REPO_DIR/src/app.ts}"

# If the instance is not listed by `ags list`, start it in the background.
if ! ags list 2>/dev/null | grep -q "^${INSTANCE}\b"; then
  ags run "$APP_PATH" &
  disown
  sleep 0.2
fi
