#!/usr/bin/env bash
set -euo pipefail

for cmd in hyprctl jq grim mkdir; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 127
  fi
done

addr="${1:?window address required}"
out="${2:?output file required}"
out_dir="$(dirname -- "$out")"

mkdir -p "$out_dir"

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
