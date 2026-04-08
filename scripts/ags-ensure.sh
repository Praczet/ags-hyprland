#!/usr/bin/env bash
# Ensure an AGS instance is running AND listening for commands.
# Usage: ags-ensure.sh [instance-name] [app-path]
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

INSTANCE="${1:-adart}"
DEFAULT_REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="${REPO_DIR:-$DEFAULT_REPO_DIR}"
APP_PATH="${2:-$REPO_DIR/src/app.ts}"
APP_DIR="$(cd -- "$(dirname -- "$APP_PATH")" && pwd)"
REPO_DIR="$(cd -- "$APP_DIR/.." && pwd)"

append_env_path_if_dir() {
  local var_name="$1"
  local dir_path="$2"
  local current_value

  [[ -d "$dir_path" ]] || return 0

  current_value="${!var_name:-}"
  if [[ -n "$current_value" ]]; then
    export "$var_name"="$dir_path:$current_value"
  else
    export "$var_name"="$dir_path"
  fi
}

append_env_path_if_dir GI_TYPELIB_PATH "/usr/local/lib/girepository-1.0"
append_env_path_if_dir LD_LIBRARY_PATH "/usr/local/lib"

export REPO_DIR
export AGS_REPO_DIR="$REPO_DIR"
export AGS_APP="$APP_PATH"

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
  OUTPUT=$(ags request -i "$INSTANCE" "true" 2>&1 || true)

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
