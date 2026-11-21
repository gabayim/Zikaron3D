import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';

const ALLOWED_ORIGIN = Deno.env.get('REFERRAL_ALLOWED_ORIGIN') ?? 'https://go.zmz.ca';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
};

async function hashIp(ip: string, salt: string): Promise<string> {
  const enc = new TextEncoder().encode(ip + salt);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const ipSalt = Deno.env.get('REFERRAL_IP_SALT') ?? 'zikaron3d-referral-salt';

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await req.json()) as { code?: string; platform?: string };
    const rawCode = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    const platform = typeof body.platform === 'string' ? body.platform.slice(0, 32) : 'unknown';

    if (!rawCode || !/^[A-Z2-9]{7}$/.test(rawCode)) {
      return new Response(JSON.stringify({ error: 'Invalid code format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify code exists and is active
    const { data: codeRow, error: codeErr } = await supabase
      .from('referral_codes')
      .select('code, disabled')
      .eq('code', rawCode)
      .maybeSingle();

    if (codeErr || !codeRow || codeRow.disabled) {
      return new Response(JSON.stringify({ error: 'Referral code not found or disabled' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Hash client IP
    const xff = req.headers.get('x-forwarded-for');
    const rawIp = xff ? xff.split(',')[0].trim() : '127.0.0.1';
    const ipHash = await hashIp(rawIp, ipSalt);

    // Insert click
    const { error: insertErr } = await supabase.from('referral_clicks').insert({
      code: rawCode,
      ip_hash: ipHash,
      platform,
    });

    if (insertErr) {
      console.warn('[referral-click] failed to insert click', insertErr);
    }

    // Clean up clicks older than 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    void supabase
      .from('referral_clicks')
      .delete()
      .lt('created_at', weekAgo)
      .then();

    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  } catch (err) {
    console.error('[referral-click] unexpected error', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
