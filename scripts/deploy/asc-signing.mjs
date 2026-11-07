#!/usr/bin/env node
/**
 * Mints an Apple Distribution certificate + App Store provisioning profile for
 * Zikaron3D through the App Store Connect API, then writes EAS *local*
 * credentials so `eas build` works without an interactive Apple login.
 *
 *   node scripts/deploy/asc-signing.mjs \
 *     --key-path "C:\Users\EREZ\Documents\AuthKey_9F3C3BR5Z2.p8" \
 *     --key-id 9F3C3BR5Z2 --issuer-id 69a6de73-a0be-47e3-e053-5b8c7c11a4d1
 *
 * Writes (all git-ignored, under ./credentials):
 *   dist.key, dist.csr, dist.cer, dist.pem, dist.p12, profile.mobileprovision
 * and ./credentials.json, which eas.json points at via credentialsSource: local.
 *
 * Apple allows two active distribution certificates per account; this creates the
 * second one only when fewer than two exist, so the certificate that signed 2.14
 * is left alone.
 */
import { execFileSync } from 'node:child_process';
import { createPrivateKey, randomBytes, sign } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const OUT = path.join(ROOT, 'credentials');
const args = process.argv.slice(2);
const arg = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const KEY_PATH = arg('key-path', process.env.ASC_KEY_PATH ?? '');
const KEY_ID = arg('key-id', process.env.ASC_KEY_ID ?? '');
const ISSUER = arg('issuer-id', process.env.ASC_ISSUER_ID ?? '');
const BUNDLE = arg('bundle-id', 'com.AdvBig.Zikaron3D');
const BASE = 'https://api.appstoreconnect.apple.com';
const IS_WIN = process.platform === 'win32';
// Windows: the mingw64 openssl ships the legacy provider needed to export a
// PKCS#12 in the 3DES/SHA1 format Apple's `security import` (used by EAS on its
// macOS builders) accepts. OpenSSL 3's default PBES2/AES-256 bags make EAS fail
// with "Unknown error" in the Prepare credentials phase.
// macOS/Linux: the system openssl already exports a compatible PKCS#12.
const OPENSSL_MODULES = 'C:\\Program Files\\Git\\mingw64\\lib\\ossl-modules';
const OPENSSL = (IS_WIN
  ? [
      'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe',
      'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
      'C:\\Windows\\System32\\openssl.exe',
      'openssl',
    ]
  : ['/usr/bin/openssl', '/opt/homebrew/bin/openssl', 'openssl']
).find((p) => p === 'openssl' || existsSync(p));

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}
if (!KEY_PATH || !KEY_ID || !ISSUER) fail('Need --key-path, --key-id and --issuer-id.');
if (!OPENSSL) fail('openssl not found.');

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const apiKey = createPrivateKey(readFileSync(KEY_PATH, 'utf8'));

function token() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iss: ISSUER, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' }));
  const sig = sign(null, Buffer.from(`${header}.${payload}`), { key: apiKey, dsaEncoding: 'ieee-p1363' });
  return `${header}.${payload}.${b64url(sig)}`;
}

async function api(pathAndQuery, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${pathAndQuery}`, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) fail(`${method} ${pathAndQuery} -> ${res.status} ${JSON.stringify(parsed?.errors ?? parsed).slice(0, 400)}`);
  return parsed;
}

const ssl = (...sslArgs) =>
  execFileSync(OPENSSL, sslArgs, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: IS_WIN ? { ...process.env, OPENSSL_MODULES } : process.env,
  });

async function main() {
  mkdirSync(OUT, { recursive: true });

  // 1. how many distribution certificates are active? (Apple allows two)
  const certs = await api('/v1/certificates?limit=200');
  const dist = (certs.data ?? []).filter((c) => c.attributes.certificateType === 'IOS_DISTRIBUTION');
  console.log(`existing IOS_DISTRIBUTION certificates: ${dist.length}`);
  for (const c of dist) console.log(`  ${c.id}  ${c.attributes.displayName}  expires ${String(c.attributes.expirationDate).slice(0, 10)}`);
  if (dist.length >= 2) fail('Apple already has two active distribution certificates. Revoke one in the Developer Portal (or run `eas credentials` interactively) and re-run.');

  // 2. key + CSR
  const keyFile = path.join(OUT, 'dist.key');
  const csrFile = path.join(OUT, 'dist.csr');
  if (!existsSync(keyFile)) ssl('genrsa', '-out', keyFile, '2048');
  ssl('req', '-new', '-key', keyFile, '-out', csrFile, '-subj', '/CN=Erez Gabay/emailAddress=gabayim@gmail.com/C=IL');
  console.log('generated CSR');

  // 3. certificate
  const csr = readFileSync(csrFile, 'utf8');
  const created = await api('/v1/certificates', {
    method: 'POST',
    body: { data: { type: 'certificates', attributes: { certificateType: 'IOS_DISTRIBUTION', csrContent: csr } } },
  });
  const certId = created.data.id;
  console.log(`created certificate ${certId} (${created.data.attributes.displayName})`);

  const cer = path.join(OUT, 'dist.cer');
  const pem = path.join(OUT, 'dist.pem');
  writeFileSync(cer, Buffer.from(created.data.attributes.certificateContent, 'base64'));
  ssl('x509', '-inform', 'DER', '-in', cer, '-out', pem);
  console.log('wrote dist.cer + dist.pem');

  // 4. .p12 for EAS (random password, stored only in the git-ignored credentials.json)
  const password = randomBytes(18).toString('base64url');
  const p12 = path.join(OUT, 'dist.p12');
  ssl('pkcs12', '-export', ...(IS_WIN ? ['-legacy'] : []), '-inkey', keyFile, '-in', pem, '-out', p12, '-passout', `pass:${password}`, '-name', 'Zikaron3D Distribution');
  console.log('wrote dist.p12');

  // 5. provisioning profile
  const bundleIds = await api(`/v1/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE)}&limit=5`);
  const bundleId = (bundleIds.data ?? [])[0];
  if (!bundleId) fail(`No App ID resource for ${BUNDLE} in the Developer Portal.`);
  const profile = await api('/v1/profiles', {
    method: 'POST',
    body: {
      data: {
        type: 'profiles',
        attributes: { name: `Zikaron3D App Store ${new Date().toISOString().slice(0, 10)}`, profileType: 'IOS_APP_STORE' },
        relationships: {
          bundleId: { data: { type: 'bundleIds', id: bundleId.id } },
          certificates: { data: [{ type: 'certificates', id: certId }] },
        },
      },
    },
  });
  const profileFile = path.join(OUT, 'profile.mobileprovision');
  writeFileSync(profileFile, Buffer.from(profile.data.attributes.profileContent, 'base64'));
  console.log(`created provisioning profile ${profile.data.id} (${profile.data.attributes.name})`);

  // 6. eas.json local credentials
  const credentialsJson = {
    ios: {
      provisioningProfilePath: 'credentials/profile.mobileprovision',
      distributionCertificate: { path: 'credentials/dist.p12', password },
    },
  };
  writeFileSync(path.join(ROOT, 'credentials.json'), `${JSON.stringify(credentialsJson, null, 2)}\n`, 'utf8');
  console.log('wrote credentials.json (git-ignored)');

  console.log('\nNext: eas.json production profile must say "credentialsSource": "local", then:');
  console.log('  npx eas-cli@latest build --platform ios --profile production --non-interactive --no-wait');
}

main().catch((error) => fail(error.message));

