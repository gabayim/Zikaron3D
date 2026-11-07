#!/usr/bin/env node
/**
 * Submission readiness audit for the Zikaron3D update. Read-only.
 *
 *   node scripts/deploy/asc-submit-readiness.mjs --key-path <p8> --key-id <id> --issuer-id <uuid>
 *
 * Prints PASS/FAIL for every prerequisite App Store Connect enforces before
 * "Submit for Review": version state, copy, screenshots, build, app info, age
 * rating, content rights, the five consumables and the review contact.
 */
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const arg = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const KEY_PATH = arg('key-path', process.env.ASC_KEY_PATH ?? '');
const KEY_ID = arg('key-id', process.env.ASC_KEY_ID ?? '');
const ISSUER = arg('issuer-id', process.env.ASC_ISSUER_ID ?? '');
const APP_ID = arg('app-id', '475133336');
const VERSION = arg('version', '2.15.0');
const BASE = 'https://api.appstoreconnect.apple.com';
const IAP_IDS = ['crystals_100', 'crystals_500', 'crystals_1200', 'starter_pack', 'shield_pack_10'];

if (!KEY_PATH || !KEY_ID || !ISSUER) {
  console.error('Need --key-path, --key-id and --issuer-id (or ASC_* env vars).');
  process.exit(2);
}

const b64url = (b) => Buffer.from(b).toString('base64url');
const key = createPrivateKey(readFileSync(KEY_PATH, 'utf8'));
function token() {
  const now = Math.floor(Date.now() / 1000);
  const h = b64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }));
  const p = b64url(JSON.stringify({ iss: ISSUER, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' }));
  return `${h}.${p}.${b64url(sign(null, Buffer.from(`${h}.${p}`), { key, dsaEncoding: 'ieee-p1363' }))}`;
}
async function api(pathAndQuery) {
  const res = await fetch(`${BASE}${pathAndQuery}`, { headers: { Authorization: `Bearer ${token()}` } });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { ok: res.ok, status: res.status, json: parsed };
}

let fails = 0;
function check(ok, label, detail = '') {
  if (!ok) fails += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
}
function note(label) {
  console.log(`NOTE  ${label}`);
}

async function main() {
  const versions = await api(`/v1/apps/${APP_ID}/appStoreVersions?limit=20&filter[platform]=IOS`);
  const version = (versions.json.data ?? []).find((v) => v.attributes.versionString === VERSION);
  if (!version) {
    check(false, `version ${VERSION} exists`);
    return;
  }
  check(true, `version ${VERSION} exists`, `state ${version.attributes.appStoreState}`);
  check(String(version.attributes.copyright ?? '').length > 0, 'copyright set', version.attributes.copyright);

  const locs = await api(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=10`);
  const loc = (locs.json.data ?? []).find((l) => l.attributes.locale === 'en-US');
  if (!loc) {
    check(false, 'en-US localization exists');
    return;
  }
  const a = loc.attributes;
  check((a.description ?? '').length > 100, 'description', `${(a.description ?? '').length} chars`);
  check((a.keywords ?? '').length > 0 && (a.keywords ?? '').length <= 100, 'keywords', `${(a.keywords ?? '').length}/100`);
  check((a.promotionalText ?? '').length <= 170, 'promotional text', `${(a.promotionalText ?? '').length}/170`);
  check((a.whatsNew ?? '').length > 10, "what's new", `${(a.whatsNew ?? '').length} chars`);
  check(!!a.supportUrl, 'support URL', a.supportUrl ?? '(missing)');
  check(!!a.marketingUrl, 'marketing URL', a.marketingUrl ?? '(missing)');

  const sets = await api(`/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?limit=20`);
  const byType = new Map();
  for (const s of sets.json.data ?? []) {
    const shots = await api(`/v1/appScreenshotSets/${s.id}/appScreenshots?limit=20`);
    byType.set(s.attributes.screenshotDisplayType, (shots.json.data ?? []).length);
  }
  const list = [...byType.entries()].map(([t, n]) => `${t}=${n}`).join(', ') || 'none';
  const hasPhone = [...byType.entries()].some(([t, n]) => /IPHONE_(69|67|65)/.test(t) && n >= 3);
  const hasPad = [...byType.entries()].some(([t, n]) => /IPAD/.test(t) && n >= 3);
  check(hasPhone, 'iPhone 6.9"/6.7" screenshots (>=3)', list);
  check(hasPad, 'iPad 13"/12.9" screenshots (>=3)', list);

  const build = await api(`/v1/appStoreVersions/${version.id}/build`);
  check(build.ok && !!build.json?.data, 'build attached', build.json?.data?.id ?? 'none yet');

  const infos = await api(`/v1/apps/${APP_ID}/appInfos?limit=10`);
  const editable = (infos.json.data ?? []).find((i) => i.attributes.state === 'PREPARE_FOR_SUBMISSION');
  check(!!editable, 'editable app info present');
  if (editable) {
    const infoLocs = await api(`/v1/appInfos/${editable.id}/appInfoLocalizations?limit=10`);
    const en = (infoLocs.json.data ?? []).find((l) => l.attributes.locale === 'en-US');
    check(!!en?.attributes.subtitle, 'subtitle', en?.attributes.subtitle ?? '(missing)');
    check(!!en?.attributes.privacyPolicyUrl, 'privacy policy URL', en?.attributes.privacyPolicyUrl ?? '(missing)');
    check(
      ['FOUR_PLUS', 'NINE_PLUS', 'THIRTEEN_PLUS'].includes(editable.attributes.appStoreAgeRating),
      'age rating',
      editable.attributes.appStoreAgeRating ?? '(none)',
    );
  }

  const app = await api(`/v1/apps/${APP_ID}`);
  check(!!app.json.data.attributes.contentRightsDeclaration, 'content rights declared', app.json.data.attributes.contentRightsDeclaration ?? '(not set - answer it in App Information)');

  const iaps = await api(`/v1/apps/${APP_ID}/inAppPurchasesV2?limit=100`);
  const products = new Map((iaps.json.data ?? []).map((p) => [p.attributes.productId, p.attributes.state]));
  for (const id of IAP_IDS) {
    check(products.has(id), `in-app purchase ${id}`, products.get(id) ?? 'MISSING (Apple cannot create these via API)');
  }
  const notReady = [...products.entries()].filter(([, state]) => !['READY_TO_SUBMIT', 'WAITING_FOR_REVIEW', 'IN_REVIEW'].includes(state));
  if (notReady.length) note(`products not submission-ready: ${notReady.map(([id, s]) => `${id}=${s}`).join(', ')}`);

  const review = await api(`/v1/appStoreVersions/${version.id}/appStoreReviewDetail`);
  check(!!review.json?.data, 'review contact + notes', review.json?.data?.id ?? 'none (needs name, phone, email)');

  console.log(`\n${fails === 0 ? 'Ready to submit.' : `${fails} item(s) still blocking submission.`}`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`\n✖ ${error.message}`);
  process.exit(1);
});

