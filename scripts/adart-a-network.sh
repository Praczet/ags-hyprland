#!/usr/bin/env bash
set -euo pipefail

# Legacy compatibility wrapper. Prefer scripts/adart-network.sh.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

exec "$SCRIPT_DIR/adart-network.sh" "$@"
