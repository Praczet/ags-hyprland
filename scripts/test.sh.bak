#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${REPO_DIR:-$(cd -- "$SCRIPT_DIR/.." && pwd)}"
ENSURE_SCRIPT="${AGS_ENSURE_SCRIPT:-$SCRIPT_DIR/ags-ensure.sh}"
INSTANCE="${AGS_INSTANCE:-adart}"
APP_PATH="${AGS_APP:-$REPO_DIR/src/app.ts}"

usage() {
  cat <<'EOF'
Usage:
  scripts/test.sh <package> [args...]

Examples:
  scripts/test.sh network
  scripts/test.sh dashboard
  scripts/test.sh clipboard
  scripts/test.sh expose
  scripts/test.sh upcheck
  scripts/test.sh aegis
  scripts/test.sh aegis full
  scripts/test.sh aegis widget aegis-memory
  scripts/test.sh wotd
  scripts/test.sh wotd compact
  scripts/test.sh osd osdVolume
  scripts/test.sh osd osdPlayer next

Packages:
  network     Toggle the network window
  dashboard   Toggle the dashboard
  clipboard   Toggle the clipboard window
  expose      Toggle expose
  upcheck     Toggle the upcheck window
  aegis       Send an aegis request
  wotd        Send a wotd request
  osd         Forward an OSD request
EOF
}

pkg="${1:-}"
if [[ -z "$pkg" ]]; then
  usage >&2
  exit 1
fi
shift || true

"$ENSURE_SCRIPT" "$INSTANCE" "$APP_PATH"

case "${pkg,,}" in
  network)
    exec "$SCRIPT_DIR/adart-network.sh" "$@"
    ;;
  dashboard)
    exec "$SCRIPT_DIR/adart-dashboard.sh" "$@"
    ;;
  clipboard)
    exec "$SCRIPT_DIR/adart-clipboard.sh" "$@"
    ;;
  expose)
    exec "$SCRIPT_DIR/adart-expose.sh" "$@"
    ;;
  upcheck)
    exec "$SCRIPT_DIR/adart-upcheck.sh" "$@"
    ;;
  aegis)
    if [[ $# -eq 0 ]]; then
      exec ags request -i "$INSTANCE" aegis
    fi

    if [[ "${1,,}" == "widget" ]]; then
      widget="${2:-}"
      if [[ -z "$widget" ]]; then
        echo "Usage: scripts/test.sh aegis widget <view>" >&2
        exit 1
      fi
      exec ags request -i "$INSTANCE" aegis widget "$widget"
    fi

    exec ags request -i "$INSTANCE" aegis "$@"
    ;;
  wotd)
    mode="${1:-card}"
    case "${mode,,}" in
      hide)
        exec ags request -i "$INSTANCE" wotd-hide
        ;;
      reload)
        exec ags request -i "$INSTANCE" wotd-reload
        ;;
      compact)
        exec ags request -i "$INSTANCE" wotd-show compact
        ;;
      definition-only)
        echo "definition-only exists in code, but the current request handler only exposes card/compact" >&2
        exit 2
        ;;
      card|show)
        exec ags request -i "$INSTANCE" wotd-show
        ;;
      *)
        echo "Unknown wotd mode: $mode" >&2
        exit 1
        ;;
    esac
    ;;
  osd)
    if [[ $# -eq 0 ]]; then
      echo "Usage: scripts/test.sh osd <osdCommand> [args...]" >&2
      exit 1
    fi
    exec "$SCRIPT_DIR/adart-osd.sh" "$@"
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    echo "Unknown package: $pkg" >&2
    usage >&2
    exit 1
    ;;
esac
