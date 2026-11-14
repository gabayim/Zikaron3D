#!/usr/bin/env node
/**
 * Uploads IAP review screenshots for all 5 In-App Purchases of Zikaron3D.
 */
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const KEY_PATH = './AuthKey_9F3C3BR5Z2.p8';
const KEY_ID = '9F3C3BR5Z2';
const ISSUER = '69a6de73-a0be-47e3-e053-5b8c7c11a4d1';
const BASE = 'https://api.appstoreconnect.apple.com';
const APP_ID = '475133336';
const SCREENSHOT_PATH = './assets/store/screenshots/final/iphone-1.png';

const b64url = (b) => Buffer.from(b).toString('base64url');
const key = createPrivateKey(readFileSync(KEY_PATH, 'utf8'));

function token() {
  const now = Math.floor(Date.now() / 1000);
  const h = b64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }));
  const p = b64url(JSON.stringify({ iss: ISSUER, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' }));
  return `${h}.${p}.${b64url(sign(null, Buffer.from(`${h}.${p}`), { key, dsaEncoding: 'ieee-p1363' }))}`;
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
    const detail = JSON.stringify(parsed?.errors ?? parsed ?? '').slice(0, 400);
    const err = new Error(`${method} ${pathAndQuery} -> ${res.status} ${detail}`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  return parsed;
}

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

async function attachReviewScreenshot(iapId, productId) {
  console.log(`Checking review screenshot for ${productId} (id ${iapId})...`);
  const existing = await api(`/v2/inAppPurchases/${iapId}/appStoreReviewScreenshot`);
  if (existing.data) {
    console.log(`  ✓ Review screenshot already exists.`);
    return;
  }

  const fileBuffer = readFileSync(SCREENSHOT_PATH);
  const fileName = path.basename(SCREENSHOT_PATH);
  const fileSize = fileBuffer.length;
  const checksum = createHash('md5').update(fileBuffer).digest('hex');

  console.log(`  ⬆ Reserving review screenshot (${(fileSize / (1024 * 1024)).toFixed(2)} MB)...`);
  const reserve = await api('/v1/inAppPurchaseAppStoreReviewScreenshots', {
    method: 'POST',
    body: {
      data: {
        type: 'inAppPurchaseAppStoreReviewScreenshots',
        attributes: { fileName, fileSize },
        relationships: {
          inAppPurchaseV2: {
            data: { type: 'inAppPurchases', id: iapId },
          },
        },
      },
    },
  });

  const shotId = reserve.data.id;
  const uploadOps = reserve.data.attributes.uploadOperations ?? [];

  for (let i = 0; i < uploadOps.length; i++) {
    const op = uploadOps[i];
    console.log(`  • Uploading part ${i + 1}/${uploadOps.length}...`);
    await uploadFileChunk(op, fileBuffer);
  }

  console.log(`  ✓ Committing upload...`);
  await api(`/v1/inAppPurchaseAppStoreReviewScreenshots/${shotId}`, {
    method: 'PATCH',
    body: {
      data: {
        type: 'inAppPurchaseAppStoreReviewScreenshots',
        id: shotId,
        attributes: {
          uploaded: true,
          sourceFileChecksum: checksum,
        },
      },
    },
  });
  console.log(`  ✓ Review screenshot attached to ${productId}!`);
}

async function main() {
  const iaps = await api(`/v1/apps/${APP_ID}/inAppPurchasesV2?limit=100`);
  for (const item of iaps.data ?? []) {
    await attachReviewScreenshot(item.id, item.attributes.productId);
  }
  console.log('\nAll IAP review screenshots processed.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
