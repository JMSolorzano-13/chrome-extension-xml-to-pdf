#!/usr/bin/env bash
# @sdd-task: Task #1 - Icons from logo.svg
# @sdd-spec: specs/spec-006-l6n-setup-deploy-features/spec.md
# @sdd-decision: ADR-011 - Public deploy kit — logo icons, allowlist ZIP
# @sdd-why: Deterministic SVG→PNG sizes required by Chrome Web Store / MV3
# @human-debug: If rsvg-convert missing → brew install librsvg

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/logo.svg"
OUT="${ROOT}/icons"

if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo "error: rsvg-convert not found. Install with: brew install librsvg" >&2
  exit 1
fi

if [[ ! -f "$SRC" ]]; then
  echo "error: logo.svg not found at $SRC" >&2
  exit 1
fi

mkdir -p "$OUT"
for size in 16 32 48 128; do
  rsvg-convert -w "$size" -h "$size" "$SRC" -o "${OUT}/${size}.png"
  echo "wrote icons/${size}.png"
done

for size in 16 128; do
  w=$(sips -g pixelWidth "${OUT}/${size}.png" 2>/dev/null | awk '/pixelWidth/{print $2}')
  h=$(sips -g pixelHeight "${OUT}/${size}.png" 2>/dev/null | awk '/pixelHeight/{print $2}')
  if [[ "$w" != "$size" || "$h" != "$size" ]]; then
    echo "error: icons/${size}.png expected ${size}x${size}, got ${w}x${h}" >&2
    exit 1
  fi
done

echo "icons OK"
