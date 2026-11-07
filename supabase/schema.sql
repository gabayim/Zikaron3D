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
