#!/usr/bin/env node
/**
 * Wires the RevenueCat Apple PUBLIC SDK key into the release:
 *   1. validates it is a public `appl_…` key (refuses `sk_…` secret keys, which
 *      would leak server-side access if shipped inside the app),
 *   2. writes EXPO_PUBLIC_REVENUECAT_APPLE_KEY into the local .env (git-ignored),
 *   3. creates/updates the same variable in the EAS `production` environment
 *      (as a sensitive value),
 *   4. re-runs the release preflight so the remaining gaps are visible.
 *
 *   node scripts/deploy/rc-wire.mjs --public-key appl_xxxxxxxxxxxx
 *   node scripts/deploy/rc-wire.mjs --public-key appl_xxx --dry-run
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const args = process.argv.slice(2);
const arg = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const DRY = args.includes('--dry-run');
const key = arg('public-key', '').trim();
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

if (!key) fail('Pass --public-key appl_…  (RevenueCat > Project settings > API keys > Public app-specific keys > Apple).');

// 1. validation - this is the whole point of the script
if (key.startsWith('sk_')) {
  fail(
    'That is a RevenueCat SECRET key. It grants server-side REST access to every subscriber and must never be\n' +
      '  embedded in a shipped app. Use the public Apple key instead: RevenueCat > Project settings > API keys >\n' +
      '  "Public app-specific keys" > Apple (it starts with appl_).',
  );
}
if (!key.startsWith('appl_')) {
  fail(`Expected an Apple public key starting with appl_, got "${key.slice(0, 6)}…". Android keys (goog_) are not used for the iOS build.`);
}
if (key.length < 20) fail('That key looks too short to be real.');

console.log(`RevenueCat public Apple key: ${key.slice(0, 12)}…${key.slice(-4)} (${key.length} chars)`);

// 2. local .env (git-ignored)
const envPath = path.join(ROOT, '.env');
const current = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
const lines = current.split(/\r?\n/);
const idx = lines.findIndex((line) => line.startsWith('EXPO_PUBLIC_REVENUECAT_APPLE_KEY='));
const entry = `EXPO_PUBLIC_REVENUECAT_APPLE_KEY=${key}`;
if (idx >= 0) lines[idx] = entry;
else lines.push(entry);
const next = lines.filter((line, i) => line.length > 0 || lines.indexOf(line) === i).join('\n');
if (!DRY) writeFileSync(envPath, next.endsWith('\n') ? next : `${next}\n`, 'utf8');
console.log(`${DRY ? 'would write' : 'wrote'} .env`);

// 3. EAS production environment
const easArgs = [
  '--yes',
  'eas-cli@latest',
  'env:create',
  '--environment',
  'production',
  '--name',
  'EXPO_PUBLIC_REVENUECAT_APPLE_KEY',
  '--value',
  key,
  '--visibility',
  'sensitive',
  '--force',
];
console.log(`\n${DRY ? 'would run' : 'running'}: npx eas-cli env:create --environment production --name EXPO_PUBLIC_REVENUECAT_APPLE_KEY --visibility sensitive --force`);
if (!DRY) {
  try {
    const out = execFileSync(NPX, easArgs, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, CI: '1' } });
    console.log(out.trim().split('\n').slice(-3).join('\n'));
  } catch (error) {
    console.error((error.stderr ?? '').toString().trim() || String(error));
    fail('Could not set the EAS variable (are you logged in? `npx eas-cli@latest whoami`).');
  }
}

// 4. preflight
console.log('\n--- release preflight ---');
try {
  const out = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'deploy', 'preflight-ios-release.mjs'), '--live-version', '2.14'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  console.log(out);
} catch (error) {
  console.log((error.stdout ?? '').toString());
  process.exitCode = 1;
}
