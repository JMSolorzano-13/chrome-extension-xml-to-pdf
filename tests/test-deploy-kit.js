/**
 * @sdd-task: Task #4 - Package + validate scripts
 * @sdd-spec: specs/spec-006-l6n-setup-deploy-features/spec.md
 * @sdd-decision: ADR-011 - Public deploy kit — logo icons, allowlist ZIP
 * @sdd-why: Executable Gherkin checks for icons, README, privacy, packaging
 * @human-debug: Failures usually mean missing icons/ or README drift — run npm run icons
 */

import { existsSync, readFileSync, renameSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${msg}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${msg}`);
  }
}

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

console.log('\n=== Spec-006 deploy kit ===\n');

// Happy: manifest icons
const manifest = JSON.parse(read('manifest.json'));
assert(manifest.icons?.['16'] === 'icons/16.png', 'manifest.icons[16]');
assert(manifest.icons?.['48'] === 'icons/48.png', 'manifest.icons[48]');
assert(manifest.icons?.['128'] === 'icons/128.png', 'manifest.icons[128]');
assert(existsSync(join(ROOT, 'icons/16.png')), 'icons/16.png exists');
assert(existsSync(join(ROOT, 'icons/48.png')), 'icons/48.png exists');
assert(existsSync(join(ROOT, 'icons/128.png')), 'icons/128.png exists');
assert(!!manifest.action?.default_icon, 'action.default_icon set');

// Limit: dimensions via sips
function dim(file) {
  const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', join(ROOT, file)], {
    encoding: 'utf8',
  });
  const w = Number(/pixelWidth:\s*(\d+)/.exec(out)?.[1]);
  const h = Number(/pixelHeight:\s*(\d+)/.exec(out)?.[1]);
  return { w, h };
}
const d16 = dim('icons/16.png');
const d128 = dim('icons/128.png');
assert(d16.w === 16 && d16.h === 16, 'icons/16.png is 16x16');
assert(d128.w === 128 && d128.h === 128, 'icons/128.png is 128x128');

// Happy: README English sections + local-only
const readme = read('README.md');
assert(/# CFDI XML to PDF \(Local\)/.test(readme), 'README title');
for (const section of [
  '## Overview',
  '## Features',
  '## Privacy',
  '## Install',
  '## Usage',
  '## Packaging for the Chrome Web Store',
]) {
  assert(readme.includes(section), `README has ${section}`);
}
assert(/100% on your device|entirely on your device|local-first/i.test(readme), 'README local-first claim');
assert(/Juan M\. Solórzano I\./.test(readme), 'README author name');
assert(readme.includes('https://github.com/JMSolorzano-13'), 'README GitHub URL');

// Error: no cloud conversion claims
const cloudClaim = /upload(?:ed|s)?\s+(?:your\s+)?(?:xml|pdf|invoices?).{0,40}(?:to\s+(?:a\s+)?(?:server|cloud)|for conversion)/i.test(
  readme,
);
assert(!cloudClaim, 'README does not claim remote/cloud conversion upload');
assert(/not uploaded|No uploads|never leave|do \*\*not\*\* collect/i.test(readme), 'README denies uploads');

// Privacy policy
const privacy = read('store/PRIVACY_POLICY.md');
assert(/do \*\*not\*\*|does \*\*not\*\*/i.test(privacy) && /Upload CFDI XML|remote servers/i.test(privacy), 'privacy: no remote transmission');
assert(/Juan M\. Solórzano I\./.test(privacy), 'privacy author');
assert(privacy.includes('https://github.com/JMSolorzano-13'), 'privacy GitHub contact');

// Package ZIP happy path
execFileSync('bash', [join(ROOT, 'scripts/package-extension.sh')], { cwd: ROOT, stdio: 'pipe' });
const zipPath = join(ROOT, 'dist/cfdi-xml-to-pdf-v1.0.0.zip');
assert(existsSync(zipPath), 'dist ZIP created');
const zipList = execFileSync('unzip', ['-l', zipPath], { encoding: 'utf8' });
assert(zipList.includes('manifest.json'), 'ZIP lists manifest.json');
assert(zipList.includes('icons/128.png'), 'ZIP lists icons/128.png');
assert(!/node_modules\/|\.git\/|\.idea\/|\.sdd-skill\//.test(zipList), 'ZIP has no forbidden paths');

// Error: missing icon → package fails with "icon"
const moved = join(ROOT, 'icons/128.png.bak-test');
renameSync(join(ROOT, 'icons/128.png'), moved);
let pkgFailed = false;
let pkgErr = '';
try {
  execFileSync('bash', [join(ROOT, 'scripts/package-extension.sh')], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
} catch (e) {
  pkgFailed = true;
  pkgErr = `${e.stderr || ''}${e.stdout || ''}${e.message || ''}`;
}
renameSync(moved, join(ROOT, 'icons/128.png'));
assert(pkgFailed, 'package exits non-zero when icon missing');
assert(/icon/i.test(pkgErr), 'missing-icon error mentions icon');

// Rebuild clean ZIP after restore
execFileSync('bash', [join(ROOT, 'scripts/package-extension.sh')], { cwd: ROOT, stdio: 'pipe' });

console.log(`\nDeploy kit: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
