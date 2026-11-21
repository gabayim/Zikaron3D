#!/usr/bin/env node
/**
 * Deploys the referral landing page and Apple App Site Association (AASA)
 * to the VPS (aaPanel web root: /www/wwwroot/go.zmz.ca).
 *
 * Usage:
 *   node scripts/deploy/deploy-referral.mjs
 *   node scripts/deploy/deploy-referral.mjs --dry-run
 *
 * Environment overrides:
 *   VPS_HOST       default: 62.84.178.215
 *   VPS_USER       default: root
 *   VPS_PORT       default: 22
 *   VPS_PATH       default: /www/wwwroot/go.zmz.ca
 *   VPS_SSH_KEY    default: ~/.ssh/new_vps (expanded)
 *   VPS_OWNER      default: www:www
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const REFERRAL_DIR = path.join(ROOT, 'public-site', 'referral');
const FLAGS = process.argv.slice(2);
const DRY = FLAGS.includes('--dry-run');

const HOST = process.env.VPS_HOST || '62.84.178.215';
const USER = process.env.VPS_USER || 'root';
const PORT = process.env.VPS_PORT || '22';
const SITE_PATH = process.env.VPS_PATH || '/www/wwwroot/go.zmz.ca';
const OWNER = process.env.VPS_OWNER || 'www:www';

let KEY = process.env.VPS_SSH_KEY || path.join(os.homedir(), '.ssh', 'new_vps');
if (!existsSync(KEY)) {
  KEY = '';
}

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function run(label, bin, args) {
  console.log(`\n==> ${label}\n    ${bin} ${args.join(' ')}`);
  if (DRY) return;
  try {
    execFileSync(bin, args, { cwd: ROOT, stdio: 'inherit' });
  } catch {
    fail(`Step failed: ${label}`);
  }
}

if (!HOST) fail('Target VPS_HOST not defined.');
const target = `${USER}@${HOST}`;
const sshOpts = ['-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=15', '-p', PORT];
const scpOpts = ['-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=15', '-P', PORT];
if (KEY) {
  sshOpts.push('-i', KEY);
  scpOpts.push('-i', KEY);
}

const indexPath = path.join(REFERRAL_DIR, 'index.html');
const aasaPath = path.join(REFERRAL_DIR, '.well-known', 'apple-app-site-association');

if (!existsSync(indexPath)) fail(`Missing file: ${indexPath}`);
if (!existsSync(aasaPath)) fail(`Missing file: ${aasaPath}`);

console.log(`Zikaron3D referral page deploy${DRY ? ' (dry run)' : ''}`);
console.log(`  target : ${target}:${PORT} -> ${SITE_PATH}`);
console.log(`  key    : ${KEY || '(default agent/agentless)'}`);

// 1. Ensure target directory structure exists
run('Create web directories', 'ssh', [...sshOpts, target, `mkdir -p ${SITE_PATH}/.well-known`]);

// 2. Upload index.html
run('Upload referral index.html', 'scp', [...scpOpts, indexPath, `${target}:${SITE_PATH}/index.html`]);

// 3. Upload AASA file
run('Upload apple-app-site-association', 'scp', [
  ...scpOpts,
  aasaPath,
  `${target}:${SITE_PATH}/.well-known/apple-app-site-association`,
]);

// 4. Fix permissions
if (OWNER) {
  run(`Set ownership (${OWNER})`, 'ssh', [...sshOpts, target, `chown -R ${OWNER} ${SITE_PATH}`]);
}

// 5. Test & reload Nginx
run(
  'Verify and reload Nginx',
  'ssh',
  [...sshOpts, target, 'nginx -t && nginx -s reload']
);

console.log('\n✓ Referral site deployed successfully.');
