-- Zikaron3D cloud schema. Paste into Supabase Dashboard > SQL Editor > Run.
-- Safe to re-run.

-- 1. Profiles Table
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  xp integer not null default 0,
  collection text[] not null default '{pip}',
  burrows_level integer not null default 0,
  orb_level integer not null default 0,
  orb_best integer not null default 0,
  star_level integer not null default 0,
  star_best integer not null default 0,
  shells_level integer not null default 0,
  vines_level integer not null default 0,
  beats_level integer not null default 0,
  peaks_level integer not null default 0,
  shields integer not null default 3,
  unlocked_worlds text[] not null default '{meadow}',
  celebrated_worlds text[] not null default '{meadow}',
  daily_key text,
  daily_completed text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- Ensure all columns exist for existing deployments
alter table public.profiles add column if not exists orb_level integer not null default 0;
alter table public.profiles add column if not exists star_level integer not null default 0;
alter table public.profiles add column if not exists shells_level integer not null default 0;
alter table public.profiles add column if not exists vines_level integer not null default 0;
alter table public.profiles add column if not exists beats_level integer not null default 0;
alter table public.profiles add column if not exists peaks_level integer not null default 0;
alter table public.profiles add column if not exists unlocked_worlds text[] not null default '{meadow}';

-- 2. Weekly Scores Table
create table if not exists public.weekly_scores (
  week text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  score integer not null default 0,
  glyph smallint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (week, user_id)
);
create index if not exists weekly_scores_rank on public.weekly_scores (week, score desc);

-- 3. Purchases Ledger Table (written by RevenueCat webhook, read by client on reinstall)
create table if not exists public.purchases (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_id text not null unique,
  product_id text not null,
  granted boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists purchases_user_idx on public.purchases (user_id);

-- 4. Constraints (Prevent corrupted / cheated values)
alter table public.profiles drop constraint if exists profiles_xp_check;
alter table public.profiles add constraint profiles_xp_check check (xp >= 0 and xp <= 10000000);

alter table public.profiles drop constraint if exists profiles_shields_check;
alter table public.profiles add constraint profiles_shields_check check (shields >= 0 and shields <= 30);

alter table public.profiles drop constraint if exists profiles_levels_check;
alter table public.profiles add constraint profiles_levels_check check (
  burrows_level >= 0 and
  orb_best >= 0 and
  star_best >= 0 and
  orb_level >= 0 and
  star_level >= 0 and
  shells_level >= 0 and
  vines_level >= 0 and
  beats_level >= 0 and
  peaks_level >= 0
);

alter table public.weekly_scores drop constraint if exists weekly_scores_score_check;
alter table public.weekly_scores add constraint weekly_scores_score_check check (score >= 0 and score <= 100000);

-- 5. Row Level Security
alter table public.profiles enable row level security;
alter table public.weekly_scores enable row level security;
alter table public.purchases enable row level security;

-- Profiles Policies
drop policy if exists "profiles read own" on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles read own" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles insert own" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles update own" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Weekly Scores Policies
-- Leaderboard rows are readable by any signed-in player; they hold no names or emails (only a creature glyph).
drop policy if exists "scores read all" on public.weekly_scores;
drop policy if exists "scores insert own" on public.weekly_scores;
drop policy if exists "scores update own" on public.weekly_scores;
create policy "scores read all" on public.weekly_scores for select to authenticated using (true);
create policy "scores insert own" on public.weekly_scores for insert with check (auth.uid() = user_id);
create policy "scores update own" on public.weekly_scores for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Purchases Policies
-- Players can only read their own purchase history; only server (service_role) can insert or update.
drop policy if exists "purchases read own" on public.purchases;
create policy "purchases read own" on public.purchases for select using (auth.uid() = user_id);

-- 6. Rate-Limiting Triggers (DB-level defense against forged scores and XP)
create or replace function public.check_score_rate_limit()
returns trigger
language plpgsql
as $$
declare
  minutes_elapsed float;
  max_allowed_jump integer;
begin
  if new.score < old.score then
    raise exception 'score cannot decrease';
  end if;

  minutes_elapsed := greatest(1.0 / 60.0, extract(epoch from (new.updated_at - old.updated_at)) / 60.0);
  max_allowed_jump := ceil(2500 * minutes_elapsed);

  if (new.score - old.score) > max_allowed_jump then
    raise exception 'score increase exceeds rate limit';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_score_rate_limit on public.weekly_scores;
create trigger trg_score_rate_limit
before update on public.weekly_scores
for each row
execute function public.check_score_rate_limit();

create or replace function public.check_xp_rate_limit()
returns trigger
language plpgsql
as $$
declare
  minutes_elapsed float;
  max_allowed_jump integer;
begin
  if new.xp < old.xp then
    raise exception 'xp cannot decrease';
  end if;

  minutes_elapsed := greatest(1.0 / 60.0, extract(epoch from (new.updated_at - old.updated_at)) / 60.0);
  max_allowed_jump := ceil(2500 * minutes_elapsed);

  if (new.xp - old.xp) > max_allowed_jump then
    raise exception 'xp increase exceeds rate limit';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_xp_rate_limit on public.profiles;
create trigger trg_xp_rate_limit
before update on public.profiles
for each row
execute function public.check_xp_rate_limit();

-- 7. In-app account deletion (App Store guideline 5.1.1(v)). Cascades to profiles, weekly_scores, purchases.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;


-- ==============================================================================
-- 8. Coupons, Referrals, and Server Grants Ledger
-- ==============================================================================

-- 8.1 Game Assets Catalog (validated foreign keys for coupons and rewards)
create table if not exists public.game_assets (
  id text primary key,
  asset_type text not null check (asset_type in ('skin', 'accessory', 'crystals', 'stardust', 'shields')),
  name text not null
);
alter table public.game_assets enable row level security;
drop policy if exists "game_assets read all" on public.game_assets;
create policy "game_assets read all" on public.game_assets for select using (true);

-- Seed base currency rows
insert into public.game_assets (id, asset_type, name) values
  ('crystals', 'crystals', 'Crystals'),
  ('stardust', 'stardust', 'Stardust'),
  ('shields', 'shields', 'Shields')
on conflict (id) do nothing;

-- 8.2 Coupons Table (Admin managed via Dashboard / SQL)
create table if not exists public.coupons (
  code text primary key check (code ~ '^[A-Z0-9]{6,16}$'),
  asset_id text not null references public.game_assets (id),
  amount integer not null default 1 check (amount between 1 and 100000),
  active boolean not null default true,
  starts_at timestamptz default now(),
  expires_at timestamptz null,
  max_redemptions integer null,
  redemption_count integer not null default 0,
  batch text,
  note text,
  created_at timestamptz default now()
);
alter table public.coupons enable row level security;
-- No client policies on coupons; clients interact exclusively via redeem_coupon RPC.

-- 8.3 Coupon Redemptions (1 per user per coupon code)
create table if not exists public.coupon_redemptions (
  code text not null references public.coupons (code) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz default now(),
  primary key (code, user_id)
);
alter table public.coupon_redemptions enable row level security;
drop policy if exists "coupon_redemptions read own" on public.coupon_redemptions;
create policy "coupon_redemptions read own" on public.coupon_redemptions for select using (auth.uid() = user_id);

-- 8.4 Coupon Attempts (Throttle brute force attempts)
create table if not exists public.coupon_attempts (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz default now()
);
create index if not exists coupon_attempts_user_time on public.coupon_attempts (user_id, created_at desc);
alter table public.coupon_attempts enable row level security;

-- 8.5 Referral Codes (Generated per user, unlimited)
create table if not exists public.referral_codes (
  code text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz default now(),
  disabled boolean not null default false
);
create index if not exists referral_codes_owner_idx on public.referral_codes (owner_id);
alter table public.referral_codes enable row level security;
drop policy if exists "referral_codes read own" on public.referral_codes;
create policy "referral_codes read own" on public.referral_codes for select using (auth.uid() = owner_id);

-- 8.6 Referral Clicks (Landing page visits prior to app install)
create table if not exists public.referral_clicks (
  id bigserial primary key,
  code text not null references public.referral_codes (code) on delete cascade,
  ip_hash text not null,
  platform text,
  created_at timestamptz default now(),
  claimed_by uuid references auth.users (id) on delete set null
);
create index if not exists referral_clicks_ip_idx on public.referral_clicks (ip_hash, created_at desc);
alter table public.referral_clicks enable row level security;

-- 8.7 Referrals Ledger (1 referral per referee)
create table if not exists public.referrals (
  referee_id uuid primary key references auth.users (id) on delete cascade,
  referrer_id uuid not null references auth.users (id) on delete cascade,
  code text,
  created_at timestamptz default now()
);
alter table public.referrals enable row level security;
drop policy if exists "referrals read related" on public.referrals;
create policy "referrals read related" on public.referrals for select using (referrer_id = auth.uid() or referee_id = auth.uid());

-- 8.8 Reward Config (Editable via Dashboard Table Editor)
create table if not exists public.reward_config (
  key text primary key,
  asset_id text not null references public.game_assets (id),
  amount integer not null default 1 check (amount between 1 and 100000)
);
alter table public.reward_config enable row level security;
drop policy if exists "reward_config read all" on public.reward_config;
create policy "reward_config read all" on public.reward_config for select using (true);

insert into public.reward_config (key, asset_id, amount) values
  ('referral_referrer', 'crystals', 500),
  ('referral_referee', 'crystals', 500)
on conflict (key) do nothing;

-- 8.9 Server Grants Ledger (Single reward reconciliation path for coupons and referrals)
create table if not exists public.grants (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('coupon', 'referral_referrer', 'referral_referee')),
  source_ref text not null,
  asset_type text not null check (asset_type in ('skin', 'accessory', 'crystals', 'stardust', 'shields')),
  asset_id text not null,
  amount integer not null default 1 check (amount between 1 and 100000),
  created_at timestamptz default now(),
  unique (user_id, source, source_ref)
);
create index if not exists grants_user_idx on public.grants (user_id);
alter table public.grants enable row level security;
drop policy if exists "grants read own" on public.grants;
create policy "grants read own" on public.grants for select using (auth.uid() = user_id);

-- ==============================================================================
-- 9. Stored Procedures: Coupons & Referrals
-- ==============================================================================

-- 9.1 Redeem Coupon RPC
create or replace function public.redeem_coupon(p_code text)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(trim(p_code));
  v_attempts int;
  v_coupon record;
  v_asset record;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'reason', 'not_signed_in');
  end if;

  if v_code is null or length(v_code) < 6 or length(v_code) > 16 then
    return json_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  -- 1 hour throttle: max 10 failed attempts
  select count(*) into v_attempts
  from public.coupon_attempts
  where user_id = v_uid and created_at > now() - interval '1 hour';

  if v_attempts >= 10 then
    return json_build_object('ok', false, 'reason', 'throttled');
  end if;

  select * into v_coupon
  from public.coupons
  where code = v_code
  for update;

  if not found then
    insert into public.coupon_attempts (user_id) values (v_uid);
    return json_build_object('ok', false, 'reason', 'not_found');
  end if;

  if not v_coupon.active then
    insert into public.coupon_attempts (user_id) values (v_uid);
    return json_build_object('ok', false, 'reason', 'inactive');
  end if;

  if v_coupon.starts_at is not null and v_coupon.starts_at > now() then
    insert into public.coupon_attempts (user_id) values (v_uid);
    return json_build_object('ok', false, 'reason', 'not_started');
  end if;

  if v_coupon.expires_at is not null and v_coupon.expires_at <= now() then
    insert into public.coupon_attempts (user_id) values (v_uid);
    return json_build_object('ok', false, 'reason', 'expired');
  end if;

  if v_coupon.max_redemptions is not null and v_coupon.redemption_count >= v_coupon.max_redemptions then
    insert into public.coupon_attempts (user_id) values (v_uid);
    return json_build_object('ok', false, 'reason', 'used_up');
  end if;

  if exists (select 1 from public.coupon_redemptions where code = v_code and user_id = v_uid) then
    return json_build_object('ok', false, 'reason', 'already_redeemed');
  end if;

  select * into v_asset from public.game_assets where id = v_coupon.asset_id;
  if not found then
    return json_build_object('ok', false, 'reason', 'asset_not_found');
  end if;

  insert into public.coupon_redemptions (code, user_id) values (v_code, v_uid);
  update public.coupons set redemption_count = redemption_count + 1 where code = v_code;

  insert into public.grants (user_id, source, source_ref, asset_type, asset_id, amount)
  values (v_uid, 'coupon', v_code, v_asset.asset_type, v_coupon.asset_id, v_coupon.amount)
  on conflict (user_id, source, source_ref) do nothing;

  return json_build_object(
    'ok', true,
    'asset_type', v_asset.asset_type,
    'asset_id', v_coupon.asset_id,
    'amount', v_coupon.amount
  );
end;
$$;
revoke all on function public.redeem_coupon(text) from public, anon;
grant execute on function public.redeem_coupon(text) to authenticated;

-- 9.2 Admin Bulk Generate Coupons
create or replace function public.admin_generate_coupons(
  p_asset_id text,
  p_count int,
  p_amount int default 1,
  p_expires_at timestamptz default null,
  p_max_redemptions int default 1,
  p_batch text default null,
  p_prefix text default ''
)
returns setof text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_generated int := 0;
  v_tries int;
  v_len int := 8;
  v_prefix text := upper(trim(coalesce(p_prefix, '')));
begin
  if not exists (select 1 from public.game_assets where id = p_asset_id) then
    raise exception 'asset % does not exist in game_assets', p_asset_id;
  end if;

  while v_generated < p_count loop
    v_tries := 0;
    loop
      v_code := v_prefix;
      for i in 1..v_len loop
        v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
      end loop;

      begin
        insert into public.coupons (
          code, asset_id, amount, expires_at, max_redemptions, batch
        ) values (
          v_code, p_asset_id, p_amount, p_expires_at, p_max_redemptions, p_batch
        );
        v_generated := v_generated + 1;
        return next v_code;
        exit;
      exception when unique_violation then
        v_tries := v_tries + 1;
        if v_tries > 50 then
          raise exception 'collision threshold exceeded';
        end if;
      end;
    end loop;
  end loop;
end;
$$;
revoke all on function public.admin_generate_coupons(text, int, int, timestamptz, int, text, text) from public, anon, authenticated;

create or replace function public.admin_set_batch_active(p_batch text, p_active bool)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.coupons set active = p_active where batch = p_batch;
end;
$$;
revoke all on function public.admin_set_batch_active(text, bool) from public, anon, authenticated;

create or replace function public.admin_expire_batch(p_batch text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.coupons set expires_at = now() where batch = p_batch;
end;
$$;
revoke all on function public.admin_expire_batch(text) from public, anon, authenticated;

-- 9.3 Create Referral Code RPC
create or replace function public.create_referral_code()
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_count_today int;
  v_tries int := 0;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  -- Anti-spam guard: max 50 codes per user per day
  select count(*) into v_count_today
  from public.referral_codes
  where owner_id = v_uid and created_at >= date_trunc('day', now());

  if v_count_today >= 50 then
    raise exception 'daily referral code creation limit reached';
  end if;

  loop
    v_code := '';
    for i in 1..7 loop
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    end loop;

    begin
      insert into public.referral_codes (code, owner_id) values (v_code, v_uid);
      return v_code;
    exception when unique_violation then
      v_tries := v_tries + 1;
      if v_tries > 20 then
        raise exception 'referral code collision threshold exceeded';
      end if;
    end;
  end loop;
end;
$$;
revoke all on function public.create_referral_code() from public, anon;
grant execute on function public.create_referral_code() to authenticated;

-- 9.4 Claim Referral RPC (Service Role only via Edge Function)
create or replace function public.claim_referral(p_code text, p_referee uuid)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_code text := upper(trim(p_code));
  v_code_row record;
  v_referee_created timestamptz;
  v_referee_reward record;
  v_referrer_reward record;
begin
  if p_referee is null or v_code is null then
    return json_build_object('ok', false, 'reason', 'invalid_params');
  end if;

  select * into v_code_row
  from public.referral_codes
  where code = v_code and not disabled;

  if not found then
    return json_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  if v_code_row.owner_id = p_referee then
    return json_build_object('ok', false, 'reason', 'self');
  end if;

  if exists (select 1 from public.referrals where referee_id = p_referee) then
    return json_build_object('ok', false, 'reason', 'already_referred');
  end if;

  -- User account must be created within the last 48 hours
  select created_at into v_referee_created
  from auth.users
  where id = p_referee;

  if not found or v_referee_created < (now() - interval '48 hours') then
    return json_build_object('ok', false, 'reason', 'too_old');
  end if;

  -- Rewards config
  select rc.*, ga.asset_type into v_referee_reward
  from public.reward_config rc
  join public.game_assets ga on ga.id = rc.asset_id
  where rc.key = 'referral_referee';

  select rc.*, ga.asset_type into v_referrer_reward
  from public.reward_config rc
  join public.game_assets ga on ga.id = rc.asset_id
  where rc.key = 'referral_referrer';

  if v_referee_reward.asset_id is null or v_referrer_reward.asset_id is null then
    return json_build_object('ok', false, 'reason', 'rewards_unconfigured');
  end if;

  -- Record referral
  insert into public.referrals (referee_id, referrer_id, code)
  values (p_referee, v_code_row.owner_id, v_code);

  -- Grant to referee
  insert into public.grants (user_id, source, source_ref, asset_type, asset_id, amount)
  values (p_referee, 'referral_referee', v_code_row.owner_id::text, v_referee_reward.asset_type, v_referee_reward.asset_id, v_referee_reward.amount)
  on conflict (user_id, source, source_ref) do nothing;

  -- Grant to referrer
  insert into public.grants (user_id, source, source_ref, asset_type, asset_id, amount)
  values (v_code_row.owner_id, 'referral_referrer', p_referee::text, v_referrer_reward.asset_type, v_referrer_reward.asset_id, v_referrer_reward.amount)
  on conflict (user_id, source, source_ref) do nothing;

  return json_build_object(
    'ok', true,
    'code', v_code,
    'referrer_id', v_code_row.owner_id
  );
end;
$$;
revoke all on function public.claim_referral(text, uuid) from public, anon, authenticated;
