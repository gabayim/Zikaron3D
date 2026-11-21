import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Parse .env manually
function loadEnv() {
  const content = fs.readFileSync('.env', 'utf8');
  const env: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      env[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim();
    }
  }
  return env;
}

const envConfig = loadEnv();
const SUPABASE_URL = envConfig.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = envConfig.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

async function runTests() {
  console.log('====================================================');
  console.log('  Zikaron3D Coupons & Referrals End-to-End Test');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(title: string, condition: boolean, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${title}`);
      passed++;
    } else {
      console.error(`[FAIL] ${title}${detail ? ` (${detail})` : ''}`);
      failed++;
    }
  }

  // --- Test 1: VPS Endpoints ---
  console.log('--- 1. Testing VPS Web & Apple App Site Association ---');
  try {
    const aasaRes = await fetch('https://go.zmz.ca/.well-known/apple-app-site-association');
    const aasaCt = aasaRes.headers.get('content-type') || '';
    const aasaJson = await aasaRes.json();
    assert(
      'AASA at /.well-known/apple-app-site-association returns HTTP 200 & application/json',
      aasaRes.status === 200 && aasaCt.includes('application/json'),
      `Status: ${aasaRes.status}, Content-Type: ${aasaCt}`
    );
    assert(
      'AASA JSON contains correct appID and components',
      aasaJson?.applinks?.details?.[0]?.appIDs?.[0] === 'DAVRE4G59N.com.AdvBig.Zikaron3D' &&
        aasaJson?.applinks?.details?.[0]?.components?.[0]?.['/'] === '/r/*',
      JSON.stringify(aasaJson)
    );

    const legacyAasaRes = await fetch('https://go.zmz.ca/apple-app-site-association');
    const legacyAasaCt = legacyAasaRes.headers.get('content-type') || '';
    assert(
      'Fallback AASA at /apple-app-site-association returns HTTP 200 & application/json',
      legacyAasaRes.status === 200 && legacyAasaCt.includes('application/json'),
      `Status: ${legacyAasaRes.status}, Content-Type: ${legacyAasaCt}`
    );

    const referralRes = await fetch('https://go.zmz.ca/r/TEST123');
    const referralCt = referralRes.headers.get('content-type') || '';
    const referralHtml = await referralRes.text();
    assert(
      'Landing page at /r/TEST123 returns HTTP 200 & text/html',
      referralRes.status === 200 && referralCt.includes('text/html') && referralHtml.includes('Zikaron3D'),
      `Status: ${referralRes.status}`
    );
  } catch (err: any) {
    assert('VPS network endpoints reachable', false, err.message);
  }

  // --- Test 2: Anonymous Sign-In ---
  console.log('\n--- 2. Testing Supabase Anonymous Sign-In ---');
  const referrerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

  let referrerUserId = '';
  try {
    const { data: authData, error: authError } = await referrerClient.auth.signInAnonymously();
    if (authError) throw authError;
    referrerUserId = authData.user?.id || '';
    assert('Anonymous user created successfully', !!referrerUserId && !!authData.session, `User ID: ${referrerUserId}`);
  } catch (err: any) {
    assert('Anonymous sign-in enabled', false, err.message);
  }

  // --- Test 3: Create Referral Code ---
  console.log('\n--- 3. Testing Referral Code Generation (RPC) ---');
  let referralCode = '';
  try {
    const { data: code, error: rpcError } = await referrerClient.rpc('create_referral_code');
    if (rpcError) throw rpcError;
    referralCode = code;
    assert(
      'create_referral_code generated 7-character code',
      typeof referralCode === 'string' && /^[A-Z2-9]{7}$/.test(referralCode),
      `Code: ${referralCode}`
    );
  } catch (err: any) {
    assert('create_referral_code RPC', false, err.message);
  }

  // --- Test 4: referral-click Edge Function ---
  console.log('\n--- 4. Testing referral-click Edge Function ---');
  try {
    const clickRes = await fetch(`${SUPABASE_URL}/functions/v1/referral-click`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://go.zmz.ca',
      },
      body: JSON.stringify({
        code: referralCode,
        platform: 'test-runner',
      }),
    });
    assert(
      'referral-click records click with HTTP 204',
      clickRes.status === 204,
      `Status: ${clickRes.status}`
    );
  } catch (err: any) {
    assert('referral-click Edge Function', false, err.message);
  }

  // --- Test 5: Coupon RPC redeem_coupon ---
  console.log('\n--- 5. Testing Coupon Redemption (RPC) ---');
  try {
    const { data: redeemNotFound, error: notFoundErr } = await referrerClient.rpc('redeem_coupon', {
      p_code: 'UNKNOWNCOUPON',
    });
    assert(
      'redeem_coupon handles invalid coupon with reason: not_found',
      !notFoundErr && redeemNotFound?.ok === false && redeemNotFound?.reason === 'not_found',
      JSON.stringify(redeemNotFound || notFoundErr)
    );
  } catch (err: any) {
    assert('redeem_coupon RPC', false, err.message);
  }

  // --- Test 6: Referral Claim via referral-claim Edge Function ---
  console.log('\n--- 6. Testing Referral Claim (Edge Function + Grants) ---');
  try {
    // Create referee client
    const refereeClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    const { data: refereeAuth, error: refereeAuthErr } = await refereeClient.auth.signInAnonymously();
    if (refereeAuthErr) throw refereeAuthErr;
    const refereeToken = refereeAuth.session?.access_token;

    // Call referral-claim Edge Function with code
    const claimRes = await fetch(`${SUPABASE_URL}/functions/v1/referral-claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refereeToken}`,
      },
      body: JSON.stringify({ code: referralCode }),
    });

    const claimResult = await claimRes.json();
    assert(
      'referral-claim claims referral successfully',
      claimRes.status === 200 && claimResult?.ok === true,
      JSON.stringify(claimResult)
    );

    // Verify referee got grant
    const { data: refereeGrants } = await refereeClient.from('grants').select('*');
    assert(
      'Referee received grant in ledger',
      Array.isArray(refereeGrants) && refereeGrants.length > 0 && refereeGrants[0].source === 'referral_referee',
      JSON.stringify(refereeGrants)
    );

    // Verify referrer got grant
    const { data: referrerGrants } = await referrerClient.from('grants').select('*');
    assert(
      'Referrer received grant in ledger',
      Array.isArray(referrerGrants) && referrerGrants.length > 0 && referrerGrants[0].source === 'referral_referrer',
      JSON.stringify(referrerGrants)
    );
  } catch (err: any) {
    assert('referral-claim flow', false, err.message);
  }

  console.log('\n====================================================');
  console.log(`  Summary: ${passed} passed, ${failed} failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
