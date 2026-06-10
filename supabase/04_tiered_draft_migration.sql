-- ============================================================
-- Migration: tiered-draft game (FINAL rules)
-- Safe to run whatever earlier migration state the DB is in.
-- Clears test picks/scores (no real users yet); keeps all tables.
-- ============================================================

-- 1. Teams: tier A/B/C (FIFA ranking based — editable; FIFA may reissue
--    the ranking on the morning of 11 June, just re-run the UPDATEs below)
alter table public.teams drop constraint if exists teams_tier_check;
alter table public.teams add column if not exists tier text;
alter table public.teams add column if not exists group_points integer not null default 0;

update public.teams set tier = 'A' where code in
  ('FRA','ESP','ARG','ENG','POR','BRA','NED','MAR','BEL','GER','CRO','COL');

update public.teams set tier = 'B' where code in
  ('SEN','MEX','USA','URU','JPN','SUI','IRN','TUR','ECU','AUT','KOR','AUS',
   'CAN','NOR','EGY','ALG','SWE','PAR');

update public.teams set tier = 'C' where code in
  ('CIV','CZE','SCO','TUN','PAN','QAT','COD','IRQ','UZB','KSA','RSA','JOR',
   'CPV','BIH','GHA','HAI','CUW','NZL');

alter table public.teams alter column tier set not null;
alter table public.teams add constraint teams_tier_check check (tier in ('A','B','C'));

-- 2. Picks: slot model replaces ranks (wipes test picks only)
delete from public.picks;
delete from public.scores;
alter table public.picks drop column if exists rank;
alter table public.picks drop column if exists is_lucky;
alter table public.picks drop column if exists is_underdog;
alter table public.picks add column if not exists slot text not null default 'A'
  check (slot in ('A','B','C','lucky'));
alter table public.picks alter column slot drop default;
alter table public.picks add constraint picks_user_slot_unique unique (user_id, slot);
-- unique (user_id, team_id) already exists → lucky can never duplicate a chosen team

-- 3. Scores: fractional totals + Giant Killer sub-total (Tier C + lucky points)
alter table public.scores alter column total_points type numeric(7,1);
alter table public.scores add column if not exists giant_killer_points numeric(7,1) not null default 0;

-- 4. Snapshot table for Group Stage Leader / Biggest Climber (captured ~27 June)
create table if not exists public.standings_snapshot (
  user_id uuid primary key references auth.users(id) on delete cascade,
  score numeric(7,1) not null,
  rank integer not null,
  captured_at timestamptz not null default now()
);
alter table public.standings_snapshot enable row level security;
drop policy if exists "snapshot_read_all" on public.standings_snapshot;
create policy "snapshot_read_all" on public.standings_snapshot for select using (true);
grant all on public.standings_snapshot to anon, authenticated, service_role;

-- 5. Leaderboard function: slot-based picks JSON + giant killer points
drop function if exists public.get_leaderboard();
create or replace function public.get_leaderboard()
returns table (
  user_id uuid,
  full_name text,
  office_location text,
  total_points numeric,
  total_goals integer,
  giant_killer_points numeric,
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
    coalesce(s.giant_killer_points, 0) as giant_killer_points,
    s.current_rank,
    coalesce(bool_or(not t.is_eliminated), false) as has_alive_pick,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'slot', pk.slot,
          'tier', t.tier,
          'name', t.name,
          'code', t.code,
          'flag', t.flag,
          'stage_reached', t.stage_reached,
          'alive', not t.is_eliminated,
          'is_champion', t.is_champion,
          'group_points', t.group_points,
          'goals_for', t.goals_for,
          'won', t.won, 'draw', t.draw, 'lost', t.lost,
          'group_letter', t.group_letter,
          'group_position', t.group_position
        ) order by case pk.slot when 'A' then 1 when 'B' then 2 when 'C' then 3 else 4 end
      ) filter (where pk.id is not null),
      '[]'::jsonb
    ) as picks
  from public.profiles p
  left join public.scores s on s.user_id = p.id
  left join public.picks pk on pk.user_id = p.id
  left join public.teams t on t.id = pk.team_id
  group by p.id, p.full_name, p.office_location,
           s.total_points, s.total_goals, s.giant_killer_points, s.current_rank
  having count(pk.id) > 0
  order by coalesce(s.current_rank, 2147483647), coalesce(s.total_points, 0) desc, p.full_name;
$$;

grant execute on function public.get_leaderboard() to anon, authenticated, service_role;

-- Sanity checks: expect A=12, B=18, C=18
select tier, count(*) from public.teams group by tier order by tier;
