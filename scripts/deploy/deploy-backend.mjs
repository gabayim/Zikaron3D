#!/usr/bin/env node
/**
 * Deploys the Zikaron3D backend to Supabase: function secrets, schema and the
 * three Edge Functions. Runs on Windows/macOS/Linux through `npx supabase`, so no
 * global CLI install is needed (Docker is not required thanks to --use-api).
 *
 *   node scripts/deploy/deploy-backend.mjs --dry-run   # print the plan
 *   node scripts/deploy/deploy-backend.mjs             # actually deploy
 *
 * Environment (a local .env is read when present; app keys live there already):
 *   SUPABASE_ACCESS_TOKEN      personal access token (Dashboard > Account > Access Tokens)
 *   SUPABASE_PROJECT_REF       project ref; falls back to the host of EXPO_PUBLIC_SUPABASE_URL
 *   SUPABASE_DB_PASSWORD       database password (needed for the schema push)
 *   REVENUECAT_WEBHOOK_SECRET  shared secret RevenueCat sends and the webhook checks
 *   APPLE_CLIENT_ID            com.AdvBig.Zikaron3D
 *   APPLE_CLIENT_SECRET        ES256 client-secret JWT signed with the Apple .p8 key
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const FLAGS = new Set(process.argv.slice(2));
const DRY = FLAGS.has('--dry-run');
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function loadEnvFile() {
  const file = path.join(ROOT, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    if (process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
  }
}

function resolveProjectRef() {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF.trim();
  const match = /^https:\/\/([a-z0-9]{20})\.supabase\.co/.exec(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '');
  return match ? match[1] : '';
}

function supabase(label, args, input) {
  console.log(`\n==> ${label}\n    npx supabase ${args.join(' ')}`);
  if (DRY) return '';
  try {
    const out = execFileSync(NPX, ['--yes', 'supabase@latest', ...args], {
      cwd: ROOT,
      input: input ?? '',
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
      maxBuffer: 32 * 1024 * 1024,
    });
    if (out.trim()) console.log(out.trim());
    return out;
  } catch (error) {
    const stderr = (error.stderr ?? '').toString().trim();
    const stdout = (error.stdout ?? '').toString().trim();
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    fail(`Step failed: ${label}`);
  }
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}


loadEnvFile();

const ref = resolveProjectRef();
if (!ref) fail('Set SUPABASE_PROJECT_REF (or EXPO_PUBLIC_SUPABASE_URL) before deploying.');
if (!process.env.SUPABASE_ACCESS_TOKEN) fail('Set SUPABASE_ACCESS_TOKEN (Dashboard > Account > Access Tokens).');

const secretNames = ['REVENUECAT_WEBHOOK_SECRET', 'APPLE_CLIENT_ID', 'APPLE_CLIENT_SECRET'];
const secrets = secretNames.filter((name) => (process.env[name] ?? '').trim().length > 0);
const pushSchema = !FLAGS.has('--skip-schema');
const deployFunctions = !FLAGS.has('--skip-functions');

if (pushSchema && !process.env.SUPABASE_DB_PASSWORD && !DRY) {
  fail('Set SUPABASE_DB_PASSWORD to apply supabase/schema.sql (or pass --skip-schema).');
}

console.log(`Zikaron3D backend deploy${DRY ? ' (dry run)' : ''}`);
console.log(`  project ref     : ${ref}`);
console.log(`  schema          : ${pushSchema ? 'supabase/schema.sql (idempotent)' : 'skipped'}`);
console.log(`  function secrets: ${secrets.length ? secrets.join(', ') : 'none in env (skipped)'}`);

supabase('Link the project', ['link', '--project-ref', ref]);

if (secrets.length) {
  supabase('Set function secrets', ['secrets', 'set', ...secrets.map((name) => `${name}=${process.env[name]}`)]);
} else {
  console.log('\n==> No function secrets in env; set REVENUECAT_WEBHOOK_SECRET / APPLE_CLIENT_ID / APPLE_CLIENT_SECRET to install them.');
}

if (pushSchema) {
  const migrationsDir = path.join(ROOT, 'supabase', 'migrations');
  const migration = path.join(migrationsDir, `${stamp()}_zikaron3d_schema.sql`);
  if (DRY) {
    console.log('\n==> Apply schema');
    console.log(`    copy supabase/schema.sql -> supabase/migrations/${path.basename(migration)}`);
    console.log('    npx supabase db push --remote --password *** --include-all');
  } else {
    mkdirSync(migrationsDir, { recursive: true });
    writeFileSync(migration, readFileSync(path.join(ROOT, 'supabase', 'schema.sql'), 'utf8'));
    try {
      // schema.sql is idempotent, so re-running is safe. The migration file is
      // generated per deploy to keep supabase/schema.sql the single source.
      supabase(
        'Apply schema (idempotent)',
        ['db', 'push', '--remote', '--password', process.env.SUPABASE_DB_PASSWORD ?? '', '--include-all'],
        'y\n',
      );
    } finally {
      rmSync(migration, { force: true });
    }
  }
}

if (deployFunctions) {
  supabase('Deploy revenuecat-webhook (gateway JWT off)', ['functions', 'deploy', 'revenuecat-webhook', '--no-verify-jwt', '--use-api']);
  supabase('Deploy link-apple', ['functions', 'deploy', 'link-apple', '--use-api']);
  supabase('Deploy delete-account', ['functions', 'deploy', 'delete-account', '--use-api']);
}

if (!DRY && secrets.includes('REVENUECAT_WEBHOOK_SECRET')) {
  const endpoint = `https://${ref}.supabase.co/functions/v1/revenuecat-webhook`;
  try {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const rejected = res.status === 401;
    console.log(`\n==> Smoke test: unsigned webhook call -> HTTP ${res.status} ${rejected ? '(OK, rejected)' : '(unexpected: check REVENUECAT_WEBHOOK_SECRET)'}`);
    if (!rejected) process.exitCode = 1;
  } catch (error) {
    console.log(`\n==> Smoke test skipped (network error): ${String(error)}`);
  }
}

console.log('\n✓ Backend deploy finished. Next: node scripts/deploy/verify-live.mjs');
