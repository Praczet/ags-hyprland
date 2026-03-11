#!/usr/bin/env bash
# Toggle the Exposé overlay in the "adart" AGS instance.
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/Development/Hyprland/ags}"
"$HOME/.local/bin/ags-ensure.sh" adart "$REPO_DIR/src/app.ts"
# ags-ensure.sh adart "$REPO_DIR/src/app.ts"
ags toggle upcheck --instance adart
