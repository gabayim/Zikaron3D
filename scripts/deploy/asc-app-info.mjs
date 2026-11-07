#!/usr/bin/env node
/**
 * Read-only dump of the live App Store Connect record for Zikaron3D.
 * Uses an App Store Connect API key (.p8). Only GET requests - nothing changes.
 *
 *   node scripts/deploy/asc-app-info.mjs --key-path "C:\Users\EREZ\Documents\AuthKey_9F3C3BR5Z2.p8" \
 *       --key-id 9F3C3BR5Z2 --issuer-id <ISSUER ID from Users and Access > Integrations>
 *
 * Or via environment: ASC_KEY_PATH, ASC_KEY_ID, ASC_ISSUER_ID
 * Optional: --bundle com.AdvBig.Zikaron3D
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
const BUNDLE = arg('bundle', 'com.AdvBig.Zikaron3D');
const BASE = 'https://api.appstoreconnect.apple.com';

const EXPECTED_IAP = ['crystals_100', 'crystals_500', 'crystals_1200', 'starter_pack', 'shield_pack_10'];

if (!KEY_PATH || !KEY_ID || !ISSUER) {
  console.error('Missing credentials. Need --key-path, --key-id and --issuer-id (or ASC_* env vars).');
  process.exit(2);
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const key = createPrivateKey(readFileSync(KEY_PATH, 'utf8'));

function token() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iss: ISSUER, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' }));
  const sig = sign(null, Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' });
  return `${header}.${payload}.${b64url(sig)}`;
}

async function api(pathAndQuery) {
  const res = await fetch(`${BASE}${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${token()}`, Accept: 'application/json' },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const detail = JSON.stringify(body?.errors ?? body ?? '').slice(0, 300);
    if (res.status === 401) {
      throw new Error(`401 Unauthorized — the key id / issuer id pair is wrong, or this is an App Store *Server* API key rather than an App Store Connect API key. ${detail}`);
    }
    if (res.status === 403) {
      throw new Error(`403 Forbidden — the key's role cannot read this resource (needs App Manager or Admin). ${detail}`);
    }
    throw new Error(`${res.status} on ${pathAndQuery} — ${detail}`);
  }
  return body;
}

const money = (n) => (n === undefined || n === null ? '' : String(n));

async function main() {
  const apps = await api(`/v1/apps?filter[bundleId]=${encodeURIComponent(BUNDLE)}&limit=10`);
  if (!apps.data?.length) {
    console.log(`No App Store Connect app found for bundle id ${BUNDLE}.`);
    return;
  }
  const app = apps.data[0];
  console.log(`App: ${app.attributes.name}  (id ${app.id})`);
  console.log(`  bundle id ....... ${app.attributes.bundleId}`);
  console.log(`  sku ............. ${app.attributes.sku}`);
  console.log(`  primary locale .. ${app.attributes.primaryLocale}`);

  const infos = await api(`/v1/apps/${app.id}/appInfos?limit=10&include=primaryCategory,ageRatingDeclaration`);
  for (const info of infos.data ?? []) {
    const cat = info.relationships?.primaryCategory?.data?.id;
    const rating = info.relationships?.ageRatingDeclaration?.data?.id;
    console.log(`\nApp information (locale ${info.attributes.locale}):`);
    console.log(`  name ............ ${info.attributes.name}`);
    console.log(`  subtitle ........ ${info.attributes.subtitle ?? '(empty)'}`);
    console.log(`  privacy url ..... ${info.attributes.privacyPolicyUrl ?? '(not set)'}`);
    console.log(`  primary category  ${cat ?? '(not set)'}`);
    console.log(`  age rating decl . ${rating ?? 'n/a'}`);
  }

  const versions = await api(`/v1/apps/${app.id}/appStoreVersions?limit=10&filter[platform]=IOS`);
  console.log('\nVersions:');
  for (const v of versions.data ?? []) {
    console.log(`  ${v.attributes.versionString.padEnd(8)} ${String(v.attributes.appStoreState).padEnd(28)} created ${v.attributes.createdDate?.slice(0, 10)} release=${v.attributes.releaseType ?? '-'}`);
  }

  const iaps = await api(`/v1/apps/${app.id}/inAppPurchasesV2?limit=50`);
  console.log('\nIn-app purchases (v2):');
  const got = new Map();
  for (const p of iaps.data ?? []) {
    got.set(p.attributes.productId, p.attributes);
    console.log(`  ${String(p.attributes.productId).padEnd(18)} ${String(p.attributes.inAppPurchaseType).padEnd(12)} ${String(p.attributes.state).padEnd(14)} ${p.attributes.name ?? ''}`);
  }
  console.log('\nRequired ids from src/services/monetization.ts:');
  for (const id of EXPECTED_IAP) {
    console.log(`  ${got.has(id) ? 'FOUND   ' : 'MISSING '} ${id}`);
  }
  const extra = [...got.keys()].filter((id) => !EXPECTED_IAP.includes(id));
  if (extra.length) console.log(`  (other products in the account: ${extra.join(', ')})`);
  console.log(`\nPrices/tiers are not exposed by this endpoint; check them in App Store Connect > In-App Purchases.`);
}

main().catch((error) => {
  console.error(`\n✖ ${error.message}`);
  process.exit(1);
});
