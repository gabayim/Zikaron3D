import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500 });
  }

  // User client to get authenticated user from token
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid or expired user session' }), { status: 401 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Revoke the Apple grants for this account (App Store guideline 5.1.1(v)).
  // `link-apple` stores the newest refresh token plus a short history, because a
  // reinstall or a second device hands back a different token each sign-in.
  const appleClientId = Deno.env.get('APPLE_CLIENT_ID'); // e.g. com.AdvBig.Zikaron3D
  const appleClientSecret = Deno.env.get('APPLE_CLIENT_SECRET');
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const stored = [
    typeof meta.apple_refresh_token === 'string' ? meta.apple_refresh_token : '',
    ...(Array.isArray(meta.apple_refresh_tokens) ? (meta.apple_refresh_tokens as unknown[]) : []),
  ].filter((token): token is string => typeof token === 'string' && token.length > 0);
  const refreshTokens = Array.from(new Set(stored));

  if (appleClientId && appleClientSecret && refreshTokens.length > 0) {
    for (const refreshToken of refreshTokens) {
      try {
        const params = new URLSearchParams({
          client_id: appleClientId,
          client_secret: appleClientSecret,
          token: refreshToken,
          token_type_hint: 'refresh_token',
        });

        const revokeRes = await fetch('https://appleid.apple.com/auth/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });

        // An already-revoked or expired token answers 400/410; keep deleting either way.
        if (!revokeRes.ok) {
          console.warn('[delete-account] Apple token revocation returned status', revokeRes.status);
        }
      } catch (appleErr) {
        console.warn('[delete-account] Apple revoke request failed', appleErr);
      }
    }
  }

  // Delete the user from auth.users (cascades to profiles, weekly_scores, purchases)
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

  if (deleteError) {
    console.error('[delete-account] Failed to delete user', deleteError.message);
    return new Response(JSON.stringify({ error: deleteError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
