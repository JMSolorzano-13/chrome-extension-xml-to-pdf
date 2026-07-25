#!/usr/bin/env bash
# @sdd-task: Task #4 - Package + validate scripts
# @sdd-spec: specs/spec-006-l6n-setup-deploy-features/spec.md
# @sdd-decision: ADR-011 - Public deploy kit — logo icons, allowlist ZIP
# @sdd-why: Chrome Web Store ZIP must exclude node_modules/.git/.sdd-skill
# @human-debug: If exit 1 with "icon" → run scripts/generate-icons.sh first

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -e "console.log(require('./manifest.json').version)" 2>/dev/null || echo "1.0.0")"
OUT_DIR="${ROOT}/dist"
ZIP_NAME="cfdi-xml-to-pdf-v${VERSION}.zip"
ZIP_PATH="${OUT_DIR}/${ZIP_NAME}"

missing=0
for f in icons/16.png icons/48.png icons/128.png; do
  if [[ ! -f "$f" ]]; then
    echo "error: required icon missing: $f" >&2
    missing=1
  fi
done
if [[ ! -f manifest.json ]]; then
  echo "error: manifest.json missing" >&2
  missing=1
fi
if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

# Validate manifest icon paths exist
node <<'NODE'
import { readFileSync, existsSync } from 'node:fs';
const m = JSON.parse(readFileSync('manifest.json', 'utf8'));
const paths = new Set();
for (const p of Object.values(m.icons || {})) paths.add(p);
const di = m.action?.default_icon;
if (typeof di === 'string') paths.add(di);
else if (di && typeof di === 'object') Object.values(di).forEach((p) => paths.add(p));
let failed = false;
for (const p of paths) {
  if (!existsSync(p)) {
    console.error(`error: icon path in manifest missing on disk: ${p}`);
    failed = true;
  }
}
if (failed) process.exit(1);
NODE

mkdir -p "$OUT_DIR"
rm -f "$ZIP_PATH"

# Allowlist only (ADR-011)
zip -r "$ZIP_PATH" \
  manifest.json \
  popup.html \
  popup.css \
  popup.js \
  logo.svg \
  icons \
  modules \
  libs \
  -x "*.DS_Store" "*/.DS_Store"

echo "created $ZIP_PATH"
LISTING="$(unzip -Z1 "$ZIP_PATH")"
echo "$LISTING" | sed -n '1,40p'

# Cleanliness checks (use unzip -Z1 names only)
if echo "$LISTING" | grep -E '(^|/)(node_modules|\.git|\.idea|\.sdd-skill)(/|$)' >/dev/null; then
  echo "error: ZIP contains forbidden paths (node_modules/.git/.idea/.sdd-skill)" >&2
  exit 1
fi
if ! echo "$LISTING" | grep -Fxq 'manifest.json'; then
  echo "error: ZIP missing manifest.json" >&2
  exit 1
fi
if ! echo "$LISTING" | grep -Fxq 'icons/128.png'; then
  echo "error: ZIP missing icons/128.png" >&2
  exit 1
fi

echo "package OK"
