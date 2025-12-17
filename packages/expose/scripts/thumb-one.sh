#!/usr/bin/env bash
set -euo pipefail

addr="${1:?window address required}"
out="${2:?output file required}"

geom="$(
  hyprctl -j clients |
    jq -r --arg a "$addr" '
      .[] | select(.address==$a)
      | "\(.at[0]),\(.at[1]) \(.size[0])x\(.size[1])"
    '
)"

if [[ -z "${geom:-}" || "${geom}" == "null" ]]; then
  exit 2
fi

grim -g "$geom" "$out"
