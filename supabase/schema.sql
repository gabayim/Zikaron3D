-- Zikaron3D cloud schema. Paste into Supabase Dashboard > SQL Editor > Run.
-- Safe to re-run.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  xp integer not null default 0,
  collection text[] not null default '{pip}',
  burrows_level integer not null default 0,
  orb_best integer not null default 0,
  star_best integer not null default 0,
  shields integer not null default 3,
  celebrated_worlds text[] not null default '{meadow}',
  daily_key text,
  daily_completed text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.weekly_scores (
  week text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  score integer not null default 0,
  glyph smallint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (week, user_id)
);
create index if not exists weekly_scores_rank on public.weekly_scores (week, score desc);

alter table public.profiles enable row level security;
alter table public.weekly_scores enable row level security;

drop policy if exists "profiles read own" on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles read own" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles insert own" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles update own" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Leaderboard rows are readable by any signed-in player; they hold no names or emails (only a creature glyph).
drop policy if exists "scores read all" on public.weekly_scores;
drop policy if exists "scores insert own" on public.weekly_scores;
drop policy if exists "scores update own" on public.weekly_scores;
create policy "scores read all" on public.weekly_scores for select to authenticated using (true);
create policy "scores insert own" on public.weekly_scores for insert with check (auth.uid() = user_id);
create policy "scores update own" on public.weekly_scores for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- In-app account deletion (App Store guideline 5.1.1(v)). Cascades to profiles and weekly_scores.
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
