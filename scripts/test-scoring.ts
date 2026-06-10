// Deterministic local test: synthetic finished tournament → check group
// points, stage, champion, slot multipliers, lucky bonuses, tiebreakers.
// Run with: npx tsx scripts/test-scoring.ts
import { aggregateTeams, computeScores, type FdMatch } from '../lib/sync'
import { playerTotal, teamScore, luckyBonus, giantKillerPoints } from '../lib/scoring'

let failures = 0
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${ok ? '✅' : '❌'} ${label}: got ${JSON.stringify(actual)}${ok ? '' : `, expected ${JSON.stringify(expected)}`}`)
  if (!ok) failures++
}

// ---------- 1. The worked check from the rules sheet (must total 192) ----------
const spain = { stage_reached: 'SEMI_FINALS', is_champion: false, group_points: 7 }   // 2W1D
const morocco = { stage_reached: 'QUARTER_FINALS', is_champion: false, group_points: 6 } // 2W
const norway = { stage_reached: 'LAST_16', is_champion: false, group_points: 4 }      // 1W1D
const uzbekistan = { stage_reached: 'QUARTER_FINALS', is_champion: false, group_points: 6 } // 2W

check('Tier A Spain (7+36)×1', teamScore(spain, 'A'), 43)
check('Tier B Morocco (6+22)×1.5', teamScore(morocco, 'B'), 42)
check('Tier C Norway (4+12)×2.5', teamScore(norway, 'C'), 40)
check('Lucky Uzbekistan (6+22)×1.5 + 25', teamScore(uzbekistan, 'lucky') + luckyBonus(uzbekistan), 67)
const workedTotal = playerTotal([
  { slot: 'A', team: spain }, { slot: 'B', team: morocco },
  { slot: 'C', team: norway }, { slot: 'lucky', team: uzbekistan },
])
check('WORKED CHECK total', workedTotal, 192)
check('Giant Killer sub-total (Norway + Uzbekistan)', giantKillerPoints([
  { slot: 'A', team: spain }, { slot: 'B', team: morocco },
  { slot: 'C', team: norway }, { slot: 'lucky', team: uzbekistan },
]), 107)

// Lucky bonuses
const champ = { stage_reached: 'FINAL', is_champion: true, group_points: 9 }
check('Lucky champion bonus (+25 +50)', luckyBonus(champ), 75)
check('Lucky champion full score (9+85)×1.5 + 75', teamScore(champ, 'lucky') + luckyBonus(champ), 216)
check('Lucky R16 team gets no bonus', luckyBonus({ stage_reached: 'LAST_16', is_champion: false, group_points: 4 }), 0)

// ---------- 2. Aggregation from a synthetic tournament ----------
const m = (id: number, stage: string, home: string, away: string, hs: number, as: number): FdMatch => ({
  id, stage, status: 'FINISHED',
  homeTeam: { tla: home }, awayTeam: { tla: away },
  score: {
    winner: hs > as ? 'HOME_TEAM' : as > hs ? 'AWAY_TEAM' : 'DRAW',
    fullTime: { home: hs, away: as },
  },
})

// BRA: group 2W1D (7 grp pts) → wins the Cup. URY group only. JPN → R16.
const matches: FdMatch[] = [
  m(1, 'GROUP_STAGE', 'BRA', 'URY', 3, 0),
  m(2, 'GROUP_STAGE', 'BRA', 'JPN', 1, 1),
  m(3, 'GROUP_STAGE', 'BRA', 'GHA', 2, 0),
  m(10, 'LAST_32', 'BRA', 'TUN', 2, 1),
  m(11, 'LAST_32', 'JPN', 'GER', 1, 0),
  m(20, 'LAST_16', 'BRA', 'NOR', 1, 0),
  m(21, 'LAST_16', 'ARG', 'JPN', 2, 0),
  m(30, 'QUARTER_FINALS', 'BRA', 'ESP', 2, 1),
  m(31, 'QUARTER_FINALS', 'ARG', 'MEX', 1, 0),
  m(40, 'SEMI_FINALS', 'BRA', 'MAR', 1, 0),
  m(41, 'SEMI_FINALS', 'ARG', 'FRA', 2, 0),
  m(50, 'FINAL', 'BRA', 'ARG', 1, 0),
]
const codes = ['BRA', 'URY' as never, 'URU', 'JPN', 'GHA', 'TUN', 'GER', 'NOR', 'ARG', 'ESP', 'MEX', 'MAR', 'FRA']
const stats = aggregateTeams(matches, codes as string[])

check('BRA group_points (2W1D, group only)', stats.get('BRA')?.group_points, 7)
check('BRA champion', stats.get('BRA')?.is_champion, true)
check('URY alias → URU group_points 0', stats.get('URU')?.group_points, 0)
check('JPN stage LAST_16', stats.get('JPN')?.stage_reached, 'LAST_16')
check('JPN group_points (1 draw)', stats.get('JPN')?.group_points, 1)
check('knockout wins do NOT add group_points', stats.get('ARG')?.group_points, 0)

// ---------- 3. computeScores end-to-end + tiebreakers ----------
const totals = computeScores([
  // u1: A=BRA champion (7+85)×1=92, B=JPN (1+12)×1.5=19.5, C=TUN (0+5)×2.5=12.5, lucky=MAR (0+36)×1.5+25=79
  { user_id: 'u1', slot: 'A', team_code: 'BRA' },
  { user_id: 'u1', slot: 'B', team_code: 'JPN' },
  { user_id: 'u1', slot: 'C', team_code: 'TUN' },
  { user_id: 'u1', slot: 'lucky', team_code: 'MAR' },
], stats)
check('u1 total via computeScores', totals.get('u1')?.total_points, 92 + 19.5 + 12.5 + 79)
check('u1 giant killer points', totals.get('u1')?.giant_killer_points, 12.5 + 79)
check('u1 lucky_stage (SF=4)', totals.get('u1')?.lucky_stage, 4)
check('u1 c_stage (R32=1)', totals.get('u1')?.c_stage, 1)

console.log(failures === 0 ? '\n🎉 All checks passed' : `\n💥 ${failures} check(s) FAILED`)
process.exit(failures === 0 ? 0 : 1)
