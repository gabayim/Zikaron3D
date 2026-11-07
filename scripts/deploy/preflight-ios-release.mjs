#!/usr/bin/env node
/**
 * Preflight for uploading an App Store UPDATE (not a first release).
 *
 *   node scripts/deploy/preflight-ios-release.mjs
 *   node scripts/deploy/preflight-ios-release.mjs --live-version 2.14 --offline
 *
 * Fails (exit 1) on anything that would block the upload or ship a broken app:
 * version not above the live one, slug vs EAS project mismatch, missing
 * EXPO_PUBLIC_* values, a service_role key, dead legal URLs, missing plugins.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const args = process.argv.slice(2);
const liveIdx = args.indexOf('--live-version');
const LIVE = liveIdx >= 0 ? args[liveIdx + 1] : '2.14';
const OFFLINE = args.includes('--offline');
const EXPECTED_SLUG = 'zikaron3d';
const EXPECTED_BUNDLE = 'com.AdvBig.Zikaron3D';
const SITE = (process.env.EXPO_PUBLIC_SITE_URL ?? 'https://zmz.ca/zikaron3d').replace(/\/$/, '');
const REQUIRED_ENV = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_REVENUECAT_APPLE_KEY'];

let failed = 0;

function report(ok, label, detail = '') {
  if (!ok) failed += 1;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
}
function warn(label) {
  console.log(`WARN ${label}`);
}

/** Numeric version compare: returns true when a > b. */
function isNewer(a, b) {
  const pa = String(a).split(/[.-]/).map((n) => Number.parseInt(n, 10) || 0);
  const pb = String(b).split(/[.-]/).map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

function loadEnvFile() {
  const file = path.join(ROOT, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
}

function jwtRole(key) {
  const part = String(key).split('.')[1];
  if (!part) return null;
  try {
    return JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).role ?? null;
  } catch {
    return null;
  }
}

loadEnvFile();
const app = JSON.parse(readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo;
const ios = app.ios ?? {};

console.log(`Zikaron3D upload preflight (live version ${LIVE})\n`);

report(isNewer(app.version, LIVE), 'version is above the live version', `app.json ${app.version} vs live ${LIVE}`);
report(Number.parseInt(ios.buildNumber ?? '', 10) > 0, 'ios.buildNumber set', String(ios.buildNumber));
report(app.slug === EXPECTED_SLUG, 'slug matches the EAS project', `${app.slug} (expected ${EXPECTED_SLUG})`);
report(ios.bundleIdentifier === EXPECTED_BUNDLE, 'bundle id unchanged', String(ios.bundleIdentifier));
report(ios.infoPlist?.ITSAppUsesNonExemptEncryption === false, 'export compliance flag set (non-exempt encryption = false)');
report(Array.isArray(ios.privacyManifests?.NSPrivacyAccessedAPITypes) && ios.privacyManifests.NSPrivacyAccessedAPITypes.length >= 3, 'privacy manifest API reasons present', `${ios.privacyManifests?.NSPrivacyAccessedAPITypes?.length ?? 0} categories`);
report((app.plugins ?? []).some((p) => (Array.isArray(p) ? p[0] : p) === 'expo-apple-authentication'), 'expo-apple-authentication plugin present');

const missing = REQUIRED_ENV.filter((name) => !(process.env[name] ?? '').trim() || (process.env[name] ?? '').includes('your_'));
report(missing.length === 0, 'build env has the app keys', missing.length ? `missing: ${missing.join(', ')}` : 'all present');
report(!(process.env.EXPO_PUBLIC_SITE_URL ?? '').includes('zikaron3d.app'), 'site URL is the live zmz.ca path', SITE);

const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
if (anonKey) {
  const role = jwtRole(anonKey);
  report(role !== 'service_role' && !anonKey.startsWith('sb_secret_'), 'anon key is not service_role', `role=${role ?? 'unknown'}`);
}

if (OFFLINE) {
  warn('legal URL check skipped (--offline)');
} else {
  for (const page of ['privacy.html', 'terms.html', 'support.html']) {
    const url = `${SITE}/${page}`;
    try {
      const res = await fetch(url, { method: 'HEAD' });
      report(res.ok, `legal page reachable: ${page}`, `HTTP ${res.status}`);
    } catch (error) {
      report(false, `legal page reachable: ${page}`, String(error));
    }
  }
}

const gitHub = path.join(ROOT, '.git');
if (existsSync(gitHub)) {
  warn('remember to commit + push before `eas build` (EAS uploads the git state)');
}

console.log('\nNext steps');
console.log(`  1. npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL       --value "<url>"        --visibility plaintext`);
console.log(`  2. npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY  --value "<anon key>"   --visibility sensitive`);
console.log(`  3. npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_REVENUECAT_APPLE_KEY --value "appl_..."    --visibility sensitive`);
console.log('  4. npx eas-cli@latest build  --platform ios --profile production');
console.log('  5. npx eas-cli@latest submit --platform ios --profile production');
console.log('\n  (nothing is committed to the repo by this script)');

console.log(failed === 0 ? '\nAll upload checks passed.' : `\n${failed} check(s) failed - fix them before uploading.`);
process.exit(failed === 0 ? 0 : 1);
