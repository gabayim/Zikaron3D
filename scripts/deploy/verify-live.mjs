#!/usr/bin/env node
/**
 * Live security verification for the Zikaron3D Supabase project — the checks the
 * plan lists under "verify live RLS and anon key only" and "the leaderboard
 * trigger rejects a forged score with a direct REST call".
 *
 *   node scripts/deploy/verify-live.mjs
 *
 * Environment (read from .env when present):
 *   EXPO_PUBLIC_SUPABASE_URL        https://<ref>.supabase.co
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY   anon key (never service_role)
 *   SUPABASE_TEST_ACCESS_TOKEN      optional: a real user access token, enables the
 *                                   forged-score / forged-purchase checks
 *   SUPABASE_TEST_USER_ID           optional: user id for that token (decoded otherwise)
 *
 * Exit code 0 = every check passed.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const results = [];
let failed = 0;

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failed += 1;
  console.log(`${ok ? '✓' : '✖'} ${name}${detail ? ` — ${detail}` : ''}`);
}

function loadEnvFile() {
  const file = path.join(ROOT, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
  }
}

function jwtClaims(key) {
  const part = String(key).split('.')[1];
  if (!part) return {};
  try {
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return {};
  }
}

/** ISO-8601 week key, mirroring src/engine/daily.ts weekKey(). */
function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx|js|mjs|json)$/.test(entry)) out.push(full);
  }
  return out;
}

loadEnvFile();

const URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const TOKEN = process.env.SUPABASE_TEST_ACCESS_TOKEN ?? '';
const CLAIMS = jwtClaims(TOKEN);
const UID = process.env.SUPABASE_TEST_USER_ID ?? CLAIMS.sub ?? '';
const WEEK = weekKey();

const LOCAL_MOCK = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(URL);
if (!URL.startsWith('https://') && !LOCAL_MOCK) {
  console.error('✖ Set EXPO_PUBLIC_SUPABASE_URL in .env (https://<ref>.supabase.co).');
  process.exit(1);
}
if (!ANON) {
  console.error('✖ Set EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.');
  process.exit(1);
}

async function rest(pathAndQuery, { method = 'GET', body, token, headers = {} } = {}) {
  try {
    const res = await fetch(`${URL}/rest/v1/${pathAndQuery}`, {
      method,
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${token ?? ANON}`,
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    return { status: res.status, body: parsed };
  } catch (error) {
    return { status: 0, body: { error: String(error) } };
  }
}

const describe = (row) => JSON.stringify(row.body ?? {}).slice(0, 160);

console.log(`Zikaron3D live verification\n  project: ${URL}\n  week   : ${WEEK}`);
console.log(`  test user: ${TOKEN ? UID || '(unknown)' : 'none (set SUPABASE_TEST_ACCESS_TOKEN for forged-write checks)'}\n`);

const role = jwtClaims(ANON).role;
record('App ships the anon key, not service_role', role !== 'service_role' && !ANON.startsWith('sb_secret_'), `role=${role ?? 'unknown'}`);

for (const table of ['profiles', 'weekly_scores', 'purchases']) {
  const { status, body } = await rest(`${table}?select=*&limit=5`);
  const rows = Array.isArray(body) ? body.length : -1;
  record(`RLS: anonymous read of ${table} returns no rows`, status === 200 && rows === 0, `HTTP ${status}, rows=${rows}`);
}

const anonPurchase = await rest('purchases', {
  method: 'POST',
  body: { user_id: crypto.randomUUID(), transaction_id: `verify-${Date.now()}`, product_id: 'crystals_100' },
});
record('RLS: anonymous write to purchases is refused', anonPurchase.status >= 400, `HTTP ${anonPurchase.status} ${describe(anonPurchase)}`);

const anonScore = await rest(`weekly_scores?week=eq.${WEEK}`, {
  method: 'PATCH',
  body: { score: 999999 },
  headers: { Prefer: 'return=representation' },
});
record(
  'RLS: anonymous score write changes no rows',
  anonScore.status >= 400 || (Array.isArray(anonScore.body) && anonScore.body.length === 0),
  `HTTP ${anonScore.status}, rows=${Array.isArray(anonScore.body) ? anonScore.body.length : 'n/a'}`,
);

if (TOKEN) {
  const upsert = await rest('weekly_scores?on_conflict=week,user_id', {
    method: 'POST',
    token: TOKEN,
    body: { week: WEEK, user_id: UID, score: 1, glyph: 0 },
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  });
  record('Test user can write its own baseline score', upsert.status < 300, `HTTP ${upsert.status} ${describe(upsert)}`);

  const forged = await rest(`weekly_scores?week=eq.${WEEK}&user_id=eq.${UID}`, {
    method: 'PATCH',
    token: TOKEN,
    body: { score: 999999 },
  });
  const forgedRejected = forged.status >= 400 && /rate limit|exceed/i.test(JSON.stringify(forged.body ?? ''));
  record('Trigger rejects a forged score jump', forgedRejected, `HTTP ${forged.status} ${describe(forged)}`);

  const decrease = await rest(`weekly_scores?week=eq.${WEEK}&user_id=eq.${UID}`, {
    method: 'PATCH',
    token: TOKEN,
    body: { score: 0 },
  });
  record('Trigger rejects a score decrease', decrease.status >= 400, `HTTP ${decrease.status} ${describe(decrease)}`);

  const forgedPurchase = await rest('purchases', {
    method: 'POST',
    token: TOKEN,
    body: { user_id: UID, transaction_id: `verify-forged-${Date.now()}`, product_id: 'crystals_1200' },
  });
  record('Client cannot insert into the purchases ledger', forgedPurchase.status >= 400, `HTTP ${forgedPurchase.status} ${describe(forgedPurchase)}`);
} else {
  console.log('\n• Forged-write checks skipped (no SUPABASE_TEST_ACCESS_TOKEN).');
}

const guardFile = path.join('services', 'supabase.ts');
const offenders = sourceFiles(path.join(ROOT, 'src')).filter((file) => {
  if (file.endsWith(guardFile)) return false;
  return readFileSync(file, 'utf8').includes('service_role');
});
record(
  'No service_role key in src/ (only the guard that rejects it)',
  offenders.length === 0,
  offenders.map((file) => path.relative(ROOT, file)).join(', '),
);

console.log(`\n${failed === 0 ? '✓ All live checks passed.' : `✖ ${failed} check(s) failed.`}`);
process.exit(failed === 0 ? 0 : 1);
