import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

async function hashIp(ip: string, salt: string): Promise<string> {
  const enc = new TextEncoder().encode(ip + salt);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const ipSalt = Deno.env.get('REFERRAL_IP_SALT') ?? 'zikaron3d-referral-salt';

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: 'Server misconfigured' }, 500);
  }

  // Verify the caller's JWT using client with anon key + auth header
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData?.user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const userId = userData.user.id;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  let code = '';
  try {
    const body = (await req.json()) as { code?: string };
    if (typeof body.code === 'string') {
      code = body.code.trim().toUpperCase();
    }
  } catch {
    // Body is optional when matching by IP
  }

  // 1. Direct code provided (e.g. from universal link or clipboard paste)
  if (code) {
    const { data: claimData, error: claimErr } = await adminClient.rpc('claim_referral', {
      p_code: code,
      p_referee: userId,
    });
    if (claimErr) {
      console.warn('[referral-claim] rpc error with code', claimErr);
      return json({ ok: false, reason: 'error', error: claimErr.message }, 500);
    }
    return json(claimData);
  }

  // 2. No code provided -> fall back to server IP match within 2 hours
  const xff = req.headers.get('x-forwarded-for');
  const rawIp = xff ? xff.split(',')[0].trim() : '127.0.0.1';
  const ipHash = await hashIp(rawIp, ipSalt);
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data: click, error: clickErr } = await adminClient
    .from('referral_clicks')
    .select('id, code')
    .eq('ip_hash', ipHash)
    .is('claimed_by', null)
    .gte('created_at', twoHoursAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (clickErr || !click) {
    return json({ ok: false, reason: 'no_match' });
  }

  const { data: claimData, error: claimErr } = await adminClient.rpc('claim_referral', {
    p_code: click.code,
    p_referee: userId,
  });

  if (claimErr) {
    console.warn('[referral-claim] rpc error with ip match', claimErr);
    return json({ ok: false, reason: 'error', error: claimErr.message }, 500);
  }

  if (claimData && typeof claimData === 'object' && (claimData as { ok?: boolean }).ok) {
    // Mark click as claimed
    void adminClient
      .from('referral_clicks')
      .update({ claimed_by: userId })
      .eq('id', click.id)
      .then();
  }

  return json(claimData);
});
