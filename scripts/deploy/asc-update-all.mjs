#!/usr/bin/env node
/**
 * asc-update-all.mjs
 * Master orchestrator to update App Store Connect metadata, upload screenshots,
 * and verify readiness for submission.
 *
 * Usage:
 *   node scripts/deploy/asc-update-all.mjs --key-path "/path/to/AuthKey_9F3C3BR5Z2.p8"
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const DEPLOY_DIR = path.join(ROOT, 'scripts', 'deploy');

const args = process.argv.slice(2);
const arg = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const KEY_PATH = arg('key-path', process.env.ASC_KEY_PATH ?? '');
const KEY_ID = arg('key-id', process.env.ASC_KEY_ID ?? '9F3C3BR5Z2');
const ISSUER = arg('issuer-id', process.env.ASC_ISSUER_ID ?? '69a6de73-a0be-47e3-e053-5b8c7c11a4d1');

if (!KEY_PATH) {
  console.error('Please specify the path to your App Store Connect .p8 key:');
  console.error('  node scripts/deploy/asc-update-all.mjs --key-path /path/to/AuthKey_9F3C3BR5Z2.p8\n');
  process.exit(1);
}

if (!existsSync(KEY_PATH)) {
  console.error(`✖ Key file not found at: ${KEY_PATH}`);
  process.exit(1);
}

const commonArgs = [
  '--key-path', KEY_PATH,
  '--key-id', KEY_ID,
  '--issuer-id', ISSUER,
];

function runStep(title, scriptName, extraArgs = []) {
  console.log(`\n================================================================`);
  console.log(`▶ STEP: ${title}`);
  console.log(`================================================================`);
  const fullArgs = [path.join(DEPLOY_DIR, scriptName), ...commonArgs, ...extraArgs];
  const res = spawnSync('node', fullArgs, { stdio: 'inherit' });
  if (res.status !== 0) {
    console.error(`\n✖ Step failed (${scriptName}) with exit code ${res.status}`);
    process.exit(res.status ?? 1);
  }
}

console.log('Starting full App Store Connect update for Zikaron3D (v2.15.0)...');

// 1. Update version metadata & URLs
runStep('Update Metadata, What\'s New & URLs', 'asc-version.mjs');

// 2. Upload Screenshots (iPhone + iPad)
runStep('Upload High-Converting Screenshots', 'asc-screenshots.mjs');

// 3. Verify readiness
runStep('Submission Readiness Audit', 'asc-submit-readiness.mjs');

console.log(`\n🎉 Full App Store Connect update completed successfully!`);
