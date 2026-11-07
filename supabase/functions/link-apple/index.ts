import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';

/**
 * Stores the Apple refresh token for the signed-in player.
 *
 * `delete-account` needs that token to call Apple's /auth/revoke endpoint, which
 * App Store guideline 5.1.1(v) requires when an app uses Sign in with Apple.
 * The token is only obtainable by exchanging the authorization code Apple hands
 * to the client, so the client posts that code here immediately after sign-in.
 *
 * Secrets: APPLE_CLIENT_ID (the bundle id) and APPLE_CLIENT_SECRET (the
 * pre-generated ES256 client-secret JWT signed with the Apple .p8 key).
 * Without these secrets the function is a no-op so sign-in never breaks.
 */

interface AppleTokenResponse {
  refresh_token?: string;
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server misconfigured' }, 500);

  let code = '';
  try {
    const body = (await req.json()) as { code?: string };
    code = typeof body.code === 'string' ? body.code : '';
  } catch {
    return json({ error: 'Invalid JSON payload' }, 400);
  }
  if (!code) return json({ error: 'Missing authorization code' }, 400);

  // Identify the caller from their Supabase access token.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) return json({ error: 'Invalid or expired user session' }, 401);

  const clientId = Deno.env.get('APPLE_CLIENT_ID');
  const clientSecret = Deno.env.get('APPLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    return json({ ok: false, message: 'Apple revocation is not configured; nothing stored' });
  }

  let token: AppleTokenResponse;
  try {
    const res = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }).toString(),
    });
    token = (await res.json()) as AppleTokenResponse;
    if (!res.ok || !token.refresh_token) {
      console.warn('[link-apple] token exchange refused', res.status, token.error);
      return json({ ok: false, error: token.error ?? 'token_exchange_failed' }, 502);
    }
  } catch (err) {
    console.warn('[link-apple] token exchange failed', err);
    return json({ ok: false, error: 'token_exchange_failed' }, 502);
  }

  // Keep the newest token prominently plus a short history, so account deletion
  // can revoke every grant this device ever created (a reinstall or a second
  // device yields a fresh refresh token).
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const history = Array.isArray(meta.apple_refresh_tokens)
    ? (meta.apple_refresh_tokens as unknown[]).filter((t): t is string => typeof t === 'string')
    : [];
  const tokens = Array.from(new Set([...history, token.refresh_token])).slice(-5);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...meta,
      apple_refresh_token: token.refresh_token,
      apple_refresh_tokens: tokens,
    },
  });

  if (updateError) {
    console.error('[link-apple] failed to store refresh token', updateError.message);
    return json({ ok: false, error: 'metadata_update_failed' }, 500);
  }

  return json({ ok: true });
});
