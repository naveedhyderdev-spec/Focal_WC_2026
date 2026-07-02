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

// ---------- 4. Prize board ----------
import { groupStageScore, computePrizes, type PrizeRow } from '../lib/prizes'

// group-stage score = Σ group_points × slot multiplier (knockouts excluded)
check('groupStageScore A=7,B=6,C=4,lucky=6',
  groupStageScore({ user_id: 'x', full_name: 'x', total_points: 0, giant_killer_points: 0, current_rank: 1,
    picks: [
      { slot: 'A', group_points: 7 }, { slot: 'B', group_points: 6 },
      { slot: 'C', group_points: 4 }, { slot: 'lucky', group_points: 6 },
    ] }),
  7 * 1 + 6 * 1.5 + 4 * 2.5 + 6 * 1.5)  // 7 + 9 + 10 + 9 = 35

// gs (group-stage score) is controlled via the A-slot group_points (×1);
// other picks 0. total_points/current_rank set the final ranking directly.
const P = (id: string, name: string, total: number, rank: number, gk: number, gs: number): PrizeRow => ({
  user_id: id, full_name: name, total_points: total, giant_killer_points: gk, current_rank: rank,
  picks: [{ slot: 'A', group_points: gs }, { slot: 'B', group_points: 0 }, { slot: 'C', group_points: 0 }, { slot: 'lucky', group_points: 0 }],
})
const prizeRows: PrizeRow[] = [
  P('a', 'Alice', 200, 1, 10, 10), // best overall
  P('b', 'Bob', 150, 2, 12, 40),   // best group-stage score
  P('c', 'Cara', 140, 3, 95, 20),  // best giant-killer haul
  P('d', 'Dan', 130, 4, 11, 5),    // weak group → big climber
  P('e', 'Eve', 120, 5, 9, 15),
  P('f', 'Finn', 10, 6, 1, 8),     // dead last
]

const prizes = computePrizes(prizeRows, { groupStageComplete: true, tournamentComplete: true })
const byKey = Object.fromEntries(prizes.map(p => [p.key, p]))
// MERIT-BASED: each prize independently goes to whoever tops it.
// Alice is #1 overall AND the biggest climber → she wins BOTH (allowed now).
check('Overall Champion = Alice', byKey.overall.names, ['Alice'])
check('Group Stage Leader = Bob (highest group score)', byKey.group_leader.names, ['Bob'])
check('Giant Killer = Cara (highest GK)', byKey.giant_killer.names, ['Cara'])
check('Biggest Climber = Alice (merit; can win 2)', byKey.climber.names, ['Alice'])
check('Wooden Spoon = Finn (last)', byKey.wooden_spoon.names, ['Finn'])
check('Group Stage Leader status won', byKey.group_leader.status, 'won')
// pre-group-stage: group leader provisional, climber pending
const early = computePrizes(prizeRows, { groupStageComplete: false, tournamentComplete: false })
check('group leader leading before groups end', early.find(p => p.key === 'group_leader')?.status, 'leading')
check('climber pending before groups end', early.find(p => p.key === 'climber')?.status, 'pending')

// genuine tie at the top (identical rank) → BOTH are Overall Champion, split
const tieRows: PrizeRow[] = [
  P('t1', 'Tara', 100, 1, 20, 30),  // current_rank 1
  P('t2', 'Umar', 100, 1, 18, 28),  // current_rank 1 (truly tied — cron gave same rank)
  P('t3', 'Vik', 90, 3, 40, 20),
  P('t4', 'Wim', 5, 4, 1, 4),
]
const tiePrizes = Object.fromEntries(computePrizes(tieRows, { groupStageComplete: true, tournamentComplete: true }).map(p => [p.key, p]))
// Genuine tie WITHIN a prize still shows co-winners who split that prize.
check('tied Overall Champions = Tara & Umar', tiePrizes.overall.names.slice().sort(), ['Tara', 'Umar'])
check('tied overall reason mentions split', /split 2 ways/.test(tiePrizes.overall.reason), true)

// MERIT: one person topping two prizes wins both — at the Final AND live,
// identically (no reshuffle ever). This is the FrankTheTank fix.
const multiRows = [P('z', 'Zoe', 200, 1, 50, 50), P('y', 'Yan', 100, 2, 10, 10)]
for (const final of [false, true]) {
  const r = Object.fromEntries(computePrizes(multiRows, { groupStageComplete: true, tournamentComplete: final }).map(p => [p.key, p]))
  check(`merit (final=${final}): Zoe wins overall AND group stage`,
    r.overall.names[0] === 'Zoe' && r.group_leader.names[0] === 'Zoe', true)
}

// ---------- 5. Change detection (Last-updated status) ----------
import { detectChanges, type FdMatch as FM, type PrevMatch, type PrevTeam, type TeamStats } from '../lib/sync'

const mkMatch = (id: number, status: string, home: string, away: string, h: number | null, a: number | null): FM => ({
  id, stage: 'GROUP_STAGE', status, homeTeam: { tla: home }, awayTeam: { tla: away },
  score: { winner: null, fullTime: { home: h, away: a } },
})
const nm = (c: string | null) => ({ EGY: 'Egypt', IRN: 'Iran', CIV: 'Ivory Coast', BRA: 'Brazil' }[c ?? ''] ?? c ?? '?')

// No change: identical new vs prev → empty summary
const prevM = new Map<number, PrevMatch>([[1, { status: 'IN_PLAY', home_score: 1, away_score: 1 }]])
check('detectChanges: no change → empty', detectChanges([mkMatch(1, 'IN_PLAY', 'EGY', 'IRN', 1, 1)], prevM, [], new Map(), nm), [])

// Live goal: score changed while in play
check('detectChanges: live goal',
  detectChanges([mkMatch(1, 'IN_PLAY', 'EGY', 'IRN', 2, 1)], prevM, [], new Map(), nm),
  ['Egypt 2–1 Iran (live)'])

// Full-time: status advanced to FINISHED
check('detectChanges: full-time',
  detectChanges([mkMatch(1, 'FINISHED', 'EGY', 'IRN', 2, 1)], prevM, [], new Map(), nm),
  ['Egypt 2–1 Iran (full-time)'])

// Team advanced a round + a champion crowned
const chgStats: TeamStats[] = [
  { code: 'CIV', stage_reached: 'LAST_32', is_champion: false, is_eliminated: false, goals_for: 0, goals_against: 0, games_played: 0, won: 0, draw: 0, lost: 0, group_points: 0 },
  { code: 'BRA', stage_reached: 'FINAL', is_champion: true, is_eliminated: false, goals_for: 0, goals_against: 0, games_played: 0, won: 0, draw: 0, lost: 0, group_points: 0 },
]
const prevT = new Map<string, PrevTeam>([
  ['CIV', { stage_reached: 'GROUP_STAGE', is_champion: false }],
  ['BRA', { stage_reached: 'FINAL', is_champion: false }],
])
check('detectChanges: advance + champion',
  detectChanges([], new Map(), chgStats, prevT, nm),
  ['Ivory Coast reached Round of 32', 'Brazil won the World Cup! 🏆'])

// ---------- 6. Robust elimination (positive proof, not sticky) ----------
// 16 fully-drawn R32 ties (home wins each) → losers out, winners alive even
// though no R16 match exists yet (the false-elimination fix).
const elimMatches: FM[] = []
for (let i = 0; i < 16; i++) elimMatches.push(m(200 + i, 'LAST_32', `T${2 * i + 1}`, `T${2 * i + 2}`, 2, 1))
elimMatches.push(m(300, 'GROUP_STAGE', 'GX', 'GY', 1, 0)) // group-only teams
const elimCodes = [...Array.from({ length: 32 }, (_, i) => `T${i + 1}`), 'GX', 'GY']
const es = aggregateTeams(elimMatches, elimCodes)
check('elim: R32 winner alive (next round still TBD)', es.get('T1')!.is_eliminated, false)
check('elim: R32 loser eliminated', es.get('T2')!.is_eliminated, true)
check('elim: group non-qualifier out once R32 fully drawn', es.get('GX')!.is_eliminated, true)

// Before the R32 bracket is fully drawn, a group team is NOT prematurely out
const partial = aggregateTeams([m(200, 'LAST_32', 'T1', 'T2', 2, 1), m(301, 'GROUP_STAGE', 'GZ', 'GW', 0, 0)], ['T1', 'T2', 'GZ', 'GW'])
check('elim: group team safe before R32 fully drawn', partial.get('GZ')!.is_eliminated, false)

// Winner-advancement: a team that WINS a knockout tie has reached the next
// round even before the feed draws that fixture (the Mexico "stuck on R32" fix).
const adv = aggregateTeams([m(500, 'LAST_32', 'MEX', 'ECU', 2, 0)], ['MEX', 'ECU'])
check('winner of R32 reached R16 (next fixture not drawn yet)', adv.get('MEX')!.stage_reached, 'LAST_16')
check('loser of R32 stays at R32', adv.get('ECU')!.stage_reached, 'LAST_32')
check('R32 winner alive', adv.get('MEX')!.is_eliminated, false)
check('R32 loser eliminated', adv.get('ECU')!.is_eliminated, true)

// Champion: winner of a finished FINAL is champion + alive; loser eliminated
const cs = aggregateTeams([m(400, 'FINAL', 'CH', 'RU', 1, 0)], ['CH', 'RU'])
check('champion set', cs.get('CH')!.is_champion, true)
check('champion not eliminated', cs.get('CH')!.is_eliminated, false)
check('final loser eliminated', cs.get('RU')!.is_eliminated, true)

console.log(failures === 0 ? '\n🎉 All checks passed' : `\n💥 ${failures} check(s) FAILED`)
process.exit(failures === 0 ? 0 : 1)
