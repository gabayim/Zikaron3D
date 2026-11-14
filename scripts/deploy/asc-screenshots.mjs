#!/usr/bin/env node
/**
 * asc-screenshots.mjs
 * Uploads real screenshot packages to App Store Connect for Zikaron3D.
 *
 * Usage:
 *   node scripts/deploy/asc-screenshots.mjs \
 *     --key-path "/path/to/AuthKey_9F3C3BR5Z2.p8" \
 *     --key-id 9F3C3BR5Z2 \
 *     --issuer-id 69a6de73-a0be-47e3-e053-5b8c7c11a4d1
 *
 * Options:
 *   --dry-run      Only validate screenshots and print upload plan without uploading
 *   --replace      Delete existing screenshots in the set before uploading new ones
 *   --locale       Locale to update (default: en-US)
 *   --version      App version string (default: 2.15.0)
 *   --app-id       App Store Apple ID (default: 475133336)
 */

import { createHash, createPrivateKey, sign } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SCREENSHOT_DIR = path.join(ROOT, 'assets', 'store', 'screenshots', 'final');

const args = process.argv.slice(2);
const arg = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const KEY_PATH = arg('key-path', process.env.ASC_KEY_PATH ?? '');
const KEY_ID = arg('key-id', process.env.ASC_KEY_ID ?? '9F3C3BR5Z2');
const ISSUER = arg('issuer-id', process.env.ASC_ISSUER_ID ?? '69a6de73-a0be-47e3-e053-5b8c7c11a4d1');
const APP_ID = arg('app-id', '475133336');
const VERSION = arg('version', '2.15.0');
const LOCALE = arg('locale', 'en-US');
const DRY = args.includes('--dry-run');
const REPLACE = args.includes('--replace') || true; // Default to replacing old screenshots
const BASE = 'https://api.appstoreconnect.apple.com';

if (!KEY_PATH || !KEY_ID || !ISSUER) {
  console.error('Missing credentials. Need --key-path, --key-id and --issuer-id (or ASC_* env vars).');
  console.error('\nExample:');
  console.error('  node scripts/deploy/asc-screenshots.mjs --key-path ~/AuthKey_9F3C3BR5Z2.p8');
  process.exit(2);
}

if (!existsSync(KEY_PATH)) {
  console.error(`✖ Key file not found at: ${KEY_PATH}`);
  process.exit(2);
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const key = createPrivateKey(readFileSync(KEY_PATH, 'utf8'));

function token() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iss: ISSUER, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' }));
  const sig = sign(null, Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' });
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

  if (!res.ok) {
    const detail = JSON.stringify(parsed?.errors ?? parsed ?? '').slice(0, 500);
    const error = new Error(`${method} ${pathAndQuery} -> ${res.status} ${detail}`);
    error.status = res.status;
    error.detail = detail;
    throw error;
  }
  return parsed;
}

// Map files to App Store screenshot targets
const SCREENSHOT_TARGETS = [
  {
    displayType: 'APP_IPHONE_67',
    label: 'iPhone 6.9"/6.7" Super Retina Display',
    files: [
      path.join(SCREENSHOT_DIR, 'iphone-1.png'),
      path.join(SCREENSHOT_DIR, 'iphone-2.png'),
      path.join(SCREENSHOT_DIR, 'iphone-3.png'),
      path.join(SCREENSHOT_DIR, 'iphone-4.png'),
      path.join(SCREENSHOT_DIR, 'iphone-5.png'),
    ],
  },
  {
    displayType: 'APP_IPAD_PRO_3GEN_129',
    label: 'iPad Pro 13"/12.9" Display',
    files: [
      path.join(SCREENSHOT_DIR, 'ipad-1.png'),
      path.join(SCREENSHOT_DIR, 'ipad-2.png'),
      path.join(SCREENSHOT_DIR, 'ipad-3.png'),
      path.join(SCREENSHOT_DIR, 'ipad-4.png'),
      path.join(SCREENSHOT_DIR, 'ipad-5.png'),
    ],
  },
];

async function uploadFileChunk(op, fileBuffer) {
  const slice = fileBuffer.subarray(op.offset, op.offset + op.length);
  const headers = {};
  for (const h of op.requestHeaders ?? []) {
    headers[h.name] = h.value;
  }

  const res = await fetch(op.url, {
    method: op.method,
    headers,
    body: slice,
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Chunk upload failed with HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
}

async function uploadScreenshot(setId, filePath) {
  const fileName = path.basename(filePath);
  const fileBuffer = readFileSync(filePath);
  const fileSize = fileBuffer.length;
  const checksum = createHash('md5').update(fileBuffer).digest('hex');

  console.log(`    ⬆ Reserving ${fileName} (${(fileSize / (1024 * 1024)).toFixed(2)} MB)...`);

  // 1. Reserve screenshot asset
  const reserveRes = await api('/v1/appScreenshots', {
    method: 'POST',
    body: {
      data: {
        type: 'appScreenshots',
        attributes: { fileName, fileSize },
        relationships: {
          appScreenshotSet: {
            data: { type: 'appScreenshotSets', id: setId },
          },
        },
      },
    },
  });

  const screenshotId = reserveRes.data.id;
  const uploadOps = reserveRes.data.attributes.uploadOperations ?? [];

  // 2. Upload each chunk
  for (let i = 0; i < uploadOps.length; i++) {
    const op = uploadOps[i];
    console.log(`      • Uploading part ${i + 1}/${uploadOps.length}...`);
    await uploadFileChunk(op, fileBuffer);
  }

  // 3. Commit upload
  console.log(`      ✓ Committing upload (checksum ${checksum.slice(0, 8)}...)...`);
  await api(`/v1/appScreenshots/${screenshotId}`, {
    method: 'PATCH',
    body: {
      data: {
        type: 'appScreenshots',
        id: screenshotId,
        attributes: {
          uploaded: true,
          sourceFileChecksum: checksum,
        },
      },
    },
  });

  console.log(`      ✓ ${fileName} committed successfully.`);
}

async function main() {
  console.log(`================================================================`);
  console.log(`  Zikaron3D App Store Connect Screenshot Uploader`);
  console.log(`  App ID: ${APP_ID} | Version: ${VERSION} | Locale: ${LOCALE}`);
  console.log(`  Dry Run: ${DRY ? 'YES' : 'NO'} | Replace Existing: ${REPLACE ? 'YES' : 'NO'}`);
  console.log(`================================================================\n`);

  // Verify all source files exist
  for (const target of SCREENSHOT_TARGETS) {
    console.log(`Verifying ${target.label} files:`);
    for (const f of target.files) {
      if (!existsSync(f)) {
        console.error(`✖ Missing screenshot file: ${f}`);
        process.exit(1);
      }
      const st = statSync(f);
      console.log(`  ✓ ${path.basename(f)} (${(st.size / 1024 / 1024).toFixed(2)} MB)`);
    }
  }

  console.log('\nConnecting to App Store Connect API...');
  const versions = await api(`/v1/apps/${APP_ID}/appStoreVersions?limit=20&filter[platform]=IOS`);
  const version = (versions.data ?? []).find((v) => v.attributes.versionString === VERSION);

  if (!version) {
    console.error(`✖ Version ${VERSION} not found on App Store Connect.`);
    console.error(`Available versions: ${(versions.data ?? []).map((v) => v.attributes.versionString).join(', ')}`);
    process.exit(1);
  }

  console.log(`Found version ${VERSION} (id ${version.id}, state ${version.attributes.appStoreState})`);

  // Find Localization
  const locs = await api(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=20`);
  const loc = (locs.data ?? []).find((l) => l.attributes.locale === LOCALE);

  if (!loc) {
    console.error(`✖ Localization ${LOCALE} not found for version ${VERSION}.`);
    process.exit(1);
  }
  console.log(`Found localization ${LOCALE} (id ${loc.id})`);

  // Query Existing Screenshot Sets
  const existingSetsRes = await api(`/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?limit=30`);
  const existingSets = existingSetsRes.data ?? [];

  for (const target of SCREENSHOT_TARGETS) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`Processing: ${target.label} (${target.displayType})`);
    console.log(`----------------------------------------------------------------`);

    let set = existingSets.find((s) => s.attributes.screenshotDisplayType === target.displayType);

    if (!set) {
      if (DRY) {
        console.log(`[DRY RUN] Would create screenshot set for ${target.displayType}`);
        continue;
      }
      console.log(`Creating screenshot set for ${target.displayType}...`);
      const createSetRes = await api('/v1/appScreenshotSets', {
        method: 'POST',
        body: {
          data: {
            type: 'appScreenshotSets',
            attributes: { screenshotDisplayType: target.displayType },
            relationships: {
              appStoreVersionLocalization: {
                data: { type: 'appStoreVersionLocalizations', id: loc.id },
              },
            },
          },
        },
      });
      set = createSetRes.data;
      console.log(`✓ Screenshot set created (id ${set.id})`);
    } else {
      console.log(`Found existing screenshot set (id ${set.id})`);
      if (REPLACE && !DRY) {
        const shotsRes = await api(`/v1/appScreenshotSets/${set.id}/appScreenshots?limit=50`);
        const shots = shotsRes.data ?? [];
        if (shots.length > 0) {
          console.log(`Clearing ${shots.length} existing screenshot(s)...`);
          for (const s of shots) {
            await api(`/v1/appScreenshots/${s.id}`, { method: 'DELETE' });
            console.log(`  - Deleted existing screenshot ${s.id}`);
          }
        }
      }
    }

    if (DRY) {
      console.log(`[DRY RUN] Would upload ${target.files.length} screenshots to set ${set?.id ?? '<new>'}`);
      continue;
    }

    // Upload each target file in sequence
    for (let idx = 0; idx < target.files.length; idx++) {
      const f = target.files[idx];
      console.log(`  [${idx + 1}/${target.files.length}] Uploading ${path.basename(f)}...`);
      await uploadScreenshot(set.id, f);
    }
  }

  console.log(`\n================================================================`);
  console.log(`✔ All App Store screenshots successfully updated on App Store Connect!`);
  console.log(`================================================================`);
}

main().catch((err) => {
  console.error(`\n✖ Upload failed: ${err.message}`);
  if (err.detail) console.error(`  Detail: ${err.detail}`);
  process.exit(1);
});
