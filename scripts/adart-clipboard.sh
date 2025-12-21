#!/usr/bin/env bash
# Toggle the clipboard history popup in the "adart" AGS instance.
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/Development/Hyprland/ags}"

ags-ensure.sh adart "$REPO_DIR/src/app.ts"
ags toggle clipboard --instance adart
