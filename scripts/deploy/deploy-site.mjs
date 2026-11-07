#!/usr/bin/env node
/**
 * Publishes public-site/ to the VPS and reloads Caddy. Uses the OpenSSH client
 * that ships with Windows 10+, macOS and Linux.
 *
 *   node scripts/deploy/deploy-site.mjs --dry-run
 *   node scripts/deploy/deploy-site.mjs --domain zikaron3d.app
 *   node scripts/deploy/deploy-site.mjs --harden        # also harden the box
 *
 * Environment:
 *   VPS_HOST       required, IP or hostname of the VPS
 *   VPS_USER       default root
 *   VPS_PORT       default 22
 *   VPS_PATH       default /var/www/zikaron3d (zmz.ca host: /www/wwwroot/zmz.ca/zikaron3d)
 *   CADDY_PATH     default /etc/caddy/Caddyfile
 *   VPS_SSH_KEY    optional path to a private key (-i)
 *   VPS_SKIP_CADDY 1 when nginx/aaPanel (or another server) already serves the path,
 *                  e.g. the zmz.ca host — then only the pages are uploaded
 *   VPS_OWNER      optional chown target after upload, e.g. www:www
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SITE = path.join(ROOT, 'public-site');
const FLAGS = process.argv.slice(2);
const DRY = FLAGS.includes('--dry-run');
const HARDEN = FLAGS.includes('--harden');
const domainFlag = FLAGS.indexOf('--domain');
const domain = domainFlag >= 0 ? FLAGS[domainFlag + 1] : '';

const HOST = process.env.VPS_HOST ?? '';
const USER = process.env.VPS_USER ?? 'root';
const PORT = process.env.VPS_PORT ?? '22';
const SITE_PATH = process.env.VPS_PATH ?? '/var/www/zikaron3d';
const CADDY_PATH = process.env.CADDY_PATH ?? '/etc/caddy/Caddyfile';
const KEY = process.env.VPS_SSH_KEY ?? '';
const SKIP_CADDY = process.env.VPS_SKIP_CADDY === '1';
const OWNER = process.env.VPS_OWNER ?? '';
const PAGES = ['index.html', 'privacy.html', 'terms.html', 'support.html'];
// brand files written by scripts/assets/buildBrand.py: logo + share card + icon
const BRAND = ['logo-dark.png', 'og-image.png', 'favicon.png'];

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

if (!HOST) fail('Set VPS_HOST (for example: $env:VPS_HOST="203.0.113.10").');
if (!existsSync(path.join(SITE, 'Caddyfile'))) fail('public-site/Caddyfile is missing.');
if (domain && !/^[a-z0-9.-]+$/i.test(domain)) fail(`Unreasonable domain: ${domain}`);

const target = `${USER}@${HOST}`;
const sshOpts = ['-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=15', '-p', PORT];
const scpOpts = ['-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=15', '-P', PORT];
if (KEY) {
  sshOpts.push('-i', KEY);
  scpOpts.push('-i', KEY);
}

// The shipped Caddyfile targets zikaron3d.app; --domain rewrites the site block.
let caddySource = path.join(SITE, 'Caddyfile');
if (domain) {
  const rewritten = readFileSync(caddySource, 'utf8').replace(
    /^[^#\s][^\n{]*\{/m,
    `${domain}, www.${domain} {`,
  );
  caddySource = path.join(os.tmpdir(), 'zikaron3d-Caddyfile');
  writeFileSync(caddySource, rewritten);
  console.log(`Caddyfile site block rewritten for ${domain}`);
}

console.log(`Zikaron3D site deploy${DRY ? ' (dry run)' : ''}`);
console.log(`  target: ${target}:${PORT} -> ${SITE_PATH}`);
console.log(`  pages : ${PAGES.join(', ')}`);

run('Create the web root', 'ssh', [...sshOpts, target, `mkdir -p ${SITE_PATH}`]);

for (const file of [...PAGES, ...BRAND]) {
  if (!existsSync(path.join(SITE, file))) fail(`Missing file: public-site/${file}`);
  run(`Upload ${file}`, 'scp', [...scpOpts, path.join(SITE, file), `${target}:${SITE_PATH}/${file}`]);
}

if (OWNER) {
  run(`Fix ownership (${OWNER})`, 'ssh', [...sshOpts, target, `chown -R ${OWNER} ${SITE_PATH}`]);
}

if (SKIP_CADDY) {
  console.log('\nVPS_SKIP_CADDY=1 — an existing web server (nginx/aaPanel) already serves this path; Caddy left untouched.');
} else {
  run('Upload Caddyfile', 'scp', [...scpOpts, caddySource, `${target}:/tmp/zikaron3d-Caddyfile`]);
  run(
    'Install and reload Caddy',
    'ssh',
    [
      ...sshOpts,
      target,
      `sudo install -m 644 /tmp/zikaron3d-Caddyfile ${CADDY_PATH} && ` +
        `sudo caddy validate --config ${CADDY_PATH} && sudo systemctl reload caddy && ` +
        `rm -f /tmp/zikaron3d-Caddyfile`,
    ],
  );
}

if (HARDEN) {
  const script = path.join(SITE, 'harden-vps.sh');
  if (!existsSync(script)) fail('public-site/harden-vps.sh is missing.');
  const local = path.join(os.tmpdir(), 'zikaron3d-harden.sh');
  copyFileSync(script, local);
  run('Upload hardening script', 'scp', [...scpOpts, local, `${target}:/tmp/zikaron3d-harden.sh`]);
  run('Run hardening script (ufw / ssh / fail2ban / upgrades / backups)', 'ssh', [...sshOpts, target, 'sudo bash /tmp/zikaron3d-harden.sh']);
}

if (!DRY) {
  const base = process.env.VPS_PUBLIC_URL?.replace(/\/$/, '') || `https://${domain || HOST}`;
  console.log(`\n✓ Site deployed. Verify:\n    curl -sI ${base}/privacy.html`);
  console.log(`App Store Connect URLs: ${base}/privacy.html, ${base}/support.html, ${base}/`);
} else {
  console.log('\nDry run only. Re-run without --dry-run to deploy.');
}
