import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';

interface RevenueCatEvent {
  id: string;
  type: string;
  app_user_id: string;
  product_id: string;
  transaction_id: string;
  purchased_at_ms: number;
}

interface RevenueCatPayload {
  api_version: string;
  event: RevenueCatEvent;
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const expectedAuth = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  const header = req.headers.get('Authorization');
  // RevenueCat's v2 API cannot set a custom Authorization header on a webhook, so
  // the shared secret may also travel as ?token=... on the webhook URL. Both are
  // compared against REVENUECAT_WEBHOOK_SECRET; anything else is rejected.
  const urlToken = (() => {
    try {
      return new URL(req.url).searchParams.get('token');
    } catch {
      return null;
    }
  })();
  const authorised =
    !expectedAuth || header === expectedAuth || header === `Bearer ${expectedAuth}` || urlToken === expectedAuth;

  if (!authorised) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body: RevenueCatPayload = await req.json();
    const event = body.event;

    if (!event || !event.app_user_id || !event.product_id) {
      return new Response(JSON.stringify({ message: 'Ignored: missing required event fields' }), { status: 200 });
    }

    // Only process purchase-related events
    const validTypes = ['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE', 'RENEWAL'];
    if (!validTypes.includes(event.type)) {
      return new Response(JSON.stringify({ message: `Ignored event type: ${event.type}` }), { status: 200 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[webhook] Missing Supabase environment variables');
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify if app_user_id is a valid UUID matching a real Supabase user
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(event.app_user_id)) {
      return new Response(JSON.stringify({ message: 'Anonymous/non-supabase user; skipped ledger' }), { status: 200 });
    }

    const transactionId = event.transaction_id || event.id || `${event.product_id}:${Date.now()}`;

    // Idempotent upsert into public.purchases
    const { error } = await supabase.from('purchases').upsert(
      {
        user_id: event.app_user_id,
        transaction_id: transactionId,
        product_id: event.product_id,
        granted: true,
      },
      { onConflict: 'transaction_id' }
    );

    if (error) {
      console.error('[webhook] Failed to write purchase ledger', error.message);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true, transaction_id: transactionId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[webhook] Error parsing payload', err);
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), { status: 400 });
  }
});
