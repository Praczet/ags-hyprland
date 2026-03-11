#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/Development/Hyprland/ags}"
"$HOME/.local/bin/ags-ensure.sh" adart "$REPO_DIR/src/app.ts"

if [[ $# -gt 0 ]]; then
  ags request networktoggle --instance adart "$1"
else
  ags request networktoggle --instance adart
fi
