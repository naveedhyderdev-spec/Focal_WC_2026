-- ============================================================
-- Focal World Cup 2026 Picks — Phase 1 schema
-- Run this WHOLE file once in Supabase → SQL Editor → New query
-- ============================================================

-- ---------- TABLES ----------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  office_location text not null default '',
  created_at timestamptz not null default now()
);

create table public.teams (
  id serial primary key,
  name text not null,
  code text not null unique,          -- our FIFA 3-letter code (URU, not URY)
  flag text not null default '',      -- emoji
  group_letter text not null,         -- A..L
  fd_team_id integer unique,          -- football-data.org team id (filled by cron)
  -- match-derived stats (written only by the cron / service role)
  stage_reached text not null default 'GROUP_STAGE',
  eliminated_at timestamptz,
  is_eliminated boolean not null default false,
  is_champion boolean not null default false,
  goals_for integer not null default 0,
  goals_against integer not null default 0,
  games_played integer not null default 0,
  won integer not null default 0,
  draw integer not null default 0,
  lost integer not null default 0,
  group_position integer
);

create table public.matches (
  id serial primary key,
  fd_match_id integer not null unique,   -- football-data match id (upsert key)
  stage text not null,                   -- GROUP_STAGE/LAST_32/LAST_16/QUARTER_FINALS/SEMI_FINALS/FINAL
  status text not null,                  -- SCHEDULED/TIMED/IN_PLAY/FINISHED...
  utc_date timestamptz,
  home_team_code text,
  away_team_code text,
  home_score integer,
  away_score integer,
  winner text,                           -- HOME_TEAM/AWAY_TEAM/DRAW
  updated_at timestamptz not null default now()
);

create table public.picks (
  id serial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id integer not null references public.teams(id),
  rank integer not null check (rank between 1 and 4),  -- 4 = lucky pick
  is_lucky boolean not null default false,
  locked_at timestamptz not null default now(),
  unique (user_id, rank),
  unique (user_id, team_id)
);

create table public.scores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_points integer not null default 0,
  total_goals integer not null default 0,
  current_rank integer,
  updated_at timestamptz not null default now()
);

-- ---------- ROW LEVEL SECURITY ----------

alter table public.profiles enable row level security;
alter table public.teams    enable row level security;
alter table public.matches  enable row level security;
alter table public.picks    enable row level security;
alter table public.scores   enable row level security;

-- profiles: user reads/updates own row (inserted by trigger below)
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- teams & matches: anyone logged in (and anon, for public leaderboard page) can read
create policy "teams_read_all"   on public.teams   for select using (true);
create policy "matches_read_all" on public.matches for select using (true);

-- picks: user reads & inserts ONLY their own; no update/delete (locked forever)
create policy "picks_select_own" on public.picks
  for select using (auth.uid() = user_id);
create policy "picks_insert_own" on public.picks
  for insert with check (auth.uid() = user_id);

-- scores: readable by everyone (leaderboard); written only by service role (bypasses RLS)
create policy "scores_read_all" on public.scores for select using (true);

-- ---------- GRANTS (v1 gotcha: service_role too, + sequences) ----------

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- ---------- TRIGGERS ----------

-- Reject any signup that is not @focalpm.com (defence in depth; app also checks)
create or replace function public.enforce_focalpm_domain()
returns trigger language plpgsql security definer as $$
begin
  if lower(new.email) not like '%@focalpm.com' then
    raise exception 'Only @focalpm.com email addresses may register';
  end if;
  return new;
end; $$;

create trigger enforce_focalpm_domain
  before insert on auth.users
  for each row execute function public.enforce_focalpm_domain();

-- Auto-create a profile row from signup metadata
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, office_location)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'office_location', '')
  );
  return new;
end; $$;

create trigger handle_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- LEADERBOARD FUNCTION ----------
-- security definer: lets the public board show everyone's picks/scores
-- without opening up the underlying tables.

create or replace function public.get_leaderboard()
returns table (
  user_id uuid,
  full_name text,
  office_location text,
  total_points integer,
  total_goals integer,
  current_rank integer,
  has_alive_pick boolean,
  picks jsonb
) language sql security definer stable as $$
  select
    p.id as user_id,
    p.full_name,
    p.office_location,
    coalesce(s.total_points, 0) as total_points,
    coalesce(s.total_goals, 0) as total_goals,
    s.current_rank,
    coalesce(bool_or(not t.is_eliminated), false) as has_alive_pick,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'rank', pk.rank,
          'is_lucky', pk.is_lucky,
          'name', t.name,
          'code', t.code,
          'flag', t.flag,
          'stage_reached', t.stage_reached,
          'alive', not t.is_eliminated,
          'is_champion', t.is_champion,
          'goals_for', t.goals_for,
          'won', t.won, 'draw', t.draw, 'lost', t.lost,
          'group_letter', t.group_letter,
          'group_position', t.group_position
        ) order by pk.rank
      ) filter (where pk.id is not null),
      '[]'::jsonb
    ) as picks
  from public.profiles p
  left join public.scores s on s.user_id = p.id
  left join public.picks pk on pk.user_id = p.id
  left join public.teams t on t.id = pk.team_id
  group by p.id, p.full_name, p.office_location, s.total_points, s.total_goals, s.current_rank
  having count(pk.id) > 0          -- only show people who have submitted picks
  order by coalesce(s.total_points, 0) desc, coalesce(s.total_goals, 0) desc, p.full_name;
$$;

grant execute on function public.get_leaderboard() to anon, authenticated, service_role;
