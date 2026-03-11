#!/usr/bin/env bash
# Ensure an AGS instance is running AND listening for commands.
# Usage: ags-ensure.sh [instance-name] [app-path]
set -euo pipefail

export GI_TYPELIB_PATH="/usr/local/lib/girepository-1.0:${GI_TYPELIB_PATH:-}"
export LD_LIBRARY_PATH="/usr/local/lib:${LD_LIBRARY_PATH:-}"

REPO_DIR="${REPO_DIR:-$HOME/Development/Hyprland/ags}"
INSTANCE="${1:-adart}"
APP_PATH="${2:-$REPO_DIR/src/app.ts}"

# 1. Start if not running
# We use -x (line match) to avoid partial matches on names
if ! ags list 2>/dev/null | grep -qx "${INSTANCE}"; then
  ags run "$APP_PATH" &
  disown
fi

# 2. WAIT loop: Ensure the instance is actually ready to accept requests
# This prevents race conditions where the app is running but DBus isn't ready.
MAX_RETRIES=40 # 4 seconds max
for ((i = 0; i < MAX_RETRIES; i++)); do
  # Capture Output/Error. '|| true' prevents crash on error code.
  OUTPUT=$(ags request "true" --instance "$INSTANCE" 2>&1 || true)

  # Success conditions:
  # - "true": AGS evaluated the JS successfully.
  # - "unknown command": AGS heard us but didn't understand (still means it's alive).
  if [[ "$OUTPUT" == *"unknown command"* ]] || [[ "$OUTPUT" == *"true"* ]]; then
    exit 0
  fi

  sleep 0.1
done

# If we get here, it timed out
echo "Error: Instance '$INSTANCE' failed to start or is not responding." >&2
exit 1
