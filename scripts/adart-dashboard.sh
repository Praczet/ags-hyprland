#!/usr/bin/env bash
# Toggle the Dashboard overlay in the "adart" AGS instance.
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/Development/Hyprland/ags}"

ags-ensure.sh adart "$REPO_DIR/src/app.ts"
if [[ $# -gt 0 ]]; then
  ags request toggleDashboard --instance adart "$1"
else
  ags request toggleDashboard --instance adart
fi
