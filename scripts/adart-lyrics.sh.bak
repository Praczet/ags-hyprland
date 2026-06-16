#!/usr/bin/env bash
# %name: Adart Lyrics
# %desc: Toggle the AGS synced lyrics overlay.
# %icon: media-playback-start-symbolic
# %terminal: false
# %categories: Utility;Audio;Hyprland;AGS
# %tags: ags, adart, lyrics, mpris, playerctl
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${REPO_DIR:-$(cd -- "$SCRIPT_DIR/.." && pwd)}"
ENSURE_SCRIPT="${AGS_ENSURE_SCRIPT:-$SCRIPT_DIR/ags-ensure.sh}"
INSTANCE="${AGS_INSTANCE:-adart}"
APP_PATH="${AGS_APP:-$REPO_DIR/src/app.ts}"

"$ENSURE_SCRIPT" "$INSTANCE" "$APP_PATH"
ags request -i "$INSTANCE" lyrics-toggle
