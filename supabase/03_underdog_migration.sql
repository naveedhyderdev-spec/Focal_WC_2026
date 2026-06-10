-- ============================================================
-- Migration: random "Lucky Country" → chosen "Underdog" pick
-- Run the WHOLE file once in Supabase → SQL Editor.
-- Clears test picks/scores (no real users yet); keeps all tables.
-- ============================================================

-- 1. Team tiers
alter table public.teams
  add column tier text not null default 'long_shot'
  check (tier in ('favourite', 'dark_horse', 'long_shot'));

update public.teams set tier = 'favourite' where code in
  ('BRA','ARG','FRA','ESP','ENG','POR','GER','NED','BEL','CRO');

update public.teams set tier = 'dark_horse' where code in
  ('URU','COL','MAR','JPN','SEN','USA','MEX','SUI','SWE','CIV',
   'ECU','AUT','NOR','KOR','EGY','TUR');

-- everything else stays 'long_shot' (the default):
-- RSA,CZE,CAN,BIH,QAT,HAI,SCO,PAR,CUW,TUN,IRN,NZL,CPV,KSA,IRQ,ALG,JOR,COD,UZB,GHA,PAN,AUS

-- 2. Picks: replace is_lucky with is_underdog (rank 1-4 check already exists)
delete from public.picks;    -- test data only — wipes the trial squads
delete from public.scores;
alter table public.picks drop column is_lucky;
alter table public.picks add column is_underdog boolean not null default false;

-- 3. Scores can now be fractional (tier ×1.5)
alter table public.scores alter column total_points type numeric(6,1);

-- 4. Leaderboard function: return is_underdog + tier instead of is_lucky
drop function if exists public.get_leaderboard();
create or replace function public.get_leaderboard()
returns table (
  user_id uuid,
  full_name text,
  office_location text,
  total_points numeric,
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
          'is_underdog', pk.is_underdog,
          'tier', t.tier,
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
  having count(pk.id) > 0
  order by coalesce(s.total_points, 0) desc, coalesce(s.total_goals, 0) desc, p.full_name;
$$;

grant execute on function public.get_leaderboard() to anon, authenticated, service_role;

-- Sanity checks: expect favourite=10, dark_horse=16, long_shot=22
select tier, count(*) from public.teams group by tier order by tier;
