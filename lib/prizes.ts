// ============================================================
// Prize board — who wins each of the five prizes, and when it's announced.
// All five are derived DETERMINISTICALLY from the leaderboard data:
//   - group-stage standings reconstruct from group_points (which freeze once
//     the group stage ends), so no snapshot table is needed.
//   - "won" = locked/final; "leading" = provisional current frontrunner;
//     "pending" = can't be determined yet.
// One prize per person: assigned largest-amount-first, skipping anyone
// already awarded — so five different people share the pot.
// ============================================================
import { SLOT_MULTIPLIER, type Slot } from './scoring'

export interface PrizePickLite {
  slot: Slot
  group_points: number
}
export interface PrizeRow {
  user_id: string
  full_name: string
  total_points: number
  giant_killer_points: number
  current_rank: number | null
  picks: PrizePickLite[]
}

export const PRIZE_BOARD = [
  { key: 'overall', label: 'Overall Champion', amount: 650, schedule: 'After the Final · ~19 July',
    explainer: 'Most total points across the whole tournament when the Final ends. The big one.' },
  { key: 'group_leader', label: 'Group Stage Leader', amount: 100, schedule: 'End of group stage · ~28 June',
    explainer: 'Most points from the group stage alone. Locked once the groups end — it stays even if they are overtaken on the overall table later.' },
  { key: 'giant_killer', label: 'Giant Killer', amount: 100, schedule: 'After the Final · ~19 July',
    explainer: 'Most points from just your Outsider (Tier C) + Lucky Country combined. Rewards whoever backed the right underdogs, even if their overall score is modest.' },
  { key: 'climber', label: 'Biggest Climber', amount: 75, schedule: 'After the Final · ~19 July',
    explainer: 'Biggest jump up the leaderboard between the end of the group stage and the Final — the best comeback.' },
  { key: 'wooden_spoon', label: 'Wooden Spoon', amount: 75, schedule: 'After the Final · ~19 July',
    explainer: 'Finishes dead last on the final table. Someone has to — and they get a prize for it!' },
] as const

/** Score a player would have had at the end of the group stage:
 *  group points only (knockout points are 0 then), × the slot multiplier. */
export function groupStageScore(row: PrizeRow): number {
  return row.picks.reduce((s, p) => s + p.group_points * (SLOT_MULTIPLIER[p.slot] ?? 0), 0)
}

/** 1-based ranks by a descending score, ties share a rank. */
function rankBy(rows: PrizeRow[], score: (r: PrizeRow) => number): Map<string, number> {
  const sorted = [...rows].sort((a, b) => score(b) - score(a))
  const ranks = new Map<string, number>()
  let rank = 0, prev: number | null = null
  sorted.forEach((r, i) => {
    const s = score(r)
    if (prev === null || s !== prev) { rank = i + 1; prev = s }
    ranks.set(r.user_id, rank)
  })
  return ranks
}

export interface PrizeResult {
  key: string
  label: string
  amount: number
  schedule: string
  explainer: string       // what the prize means (hover tooltip)
  status: 'won' | 'leading' | 'pending'
  names: string[]         // 1 normally; 2+ on a genuine tie (they split)
  reason: string          // why they lead/won, with the number
}

export function computePrizes(
  rows: PrizeRow[],
  opts: { groupStageComplete: boolean; tournamentComplete: boolean },
): PrizeResult[] {
  if (rows.length === 0)
    return PRIZE_BOARD.map(p => ({ ...p, status: 'pending' as const, names: [], reason: '' }))

  const gsScore = new Map(rows.map(r => [r.user_id, groupStageScore(r)]))
  const gsRank = rankBy(rows, r => gsScore.get(r.user_id) ?? 0)
  const finalRank = (r: PrizeRow) => r.current_rank ?? rows.length
  const climb = (r: PrizeRow) => (gsRank.get(r.user_id) ?? rows.length) - finalRank(r)

  const candidates: Record<string, PrizeRow[]> = {
    overall: [...rows].sort((a, b) => finalRank(a) - finalRank(b)),
    group_leader: [...rows].sort((a, b) => (gsScore.get(b.user_id) ?? 0) - (gsScore.get(a.user_id) ?? 0)),
    giant_killer: [...rows].sort((a, b) => b.giant_killer_points - a.giant_killer_points),
    climber: [...rows].sort((a, b) => climb(b) - climb(a)),
    wooden_spoon: [...rows].sort((a, b) => finalRank(b) - finalRank(a)),
  }

  // Tie key per prize: players sharing this exact value are GENUINELY tied
  // (after tiebreakers) and become co-winners who split the prize. finalRank
  // already encodes the points + lucky/Outsider tiebreakers from the cron, so
  // identical finalRank = a true tie for overall/wooden-spoon.
  const r1 = (x: number) => x.toFixed(1)
  const tieKey = (key: string, r: PrizeRow): string => {
    switch (key) {
      case 'overall': case 'wooden_spoon': return `r${finalRank(r)}`
      case 'group_leader': return `g${r1(gsScore.get(r.user_id) ?? 0)}`
      case 'giant_killer': return `k${r1(r.giant_killer_points)}`
      case 'climber': return `c${(gsRank.get(r.user_id) ?? rows.length) - finalRank(r)}`
      default: return ''
    }
  }

  // MERIT-BASED (confirmed rule): each prize goes to whoever genuinely tops
  // it — independently. The same person CAN win several titles; no
  // redistribution. This keeps every prize stable: the Group Stage Leader
  // never changes because someone else moved on the overall table. The only
  // multi-name case is a GENUINE tie within a single prize (same metric value
  // after tiebreakers), where the tied players are co-winners.
  const winners: Record<string, PrizeRow[]> = {}
  for (const p of PRIZE_BOARD) {
    const pool = candidates[p.key]
    if (pool.length === 0) { winners[p.key] = []; continue }
    const topKey = tieKey(p.key, pool[0])
    winners[p.key] = pool.filter(r => tieKey(p.key, r) === topKey)
  }

  const statusFor = (key: string): 'won' | 'leading' | 'pending' => {
    if (key === 'group_leader') return opts.groupStageComplete ? 'won' : 'leading'
    if (key === 'climber') {
      if (opts.tournamentComplete) return 'won'
      return opts.groupStageComplete ? 'leading' : 'pending'
    }
    return opts.tournamentComplete ? 'won' : 'leading'
  }

  const reasonFor = (key: string, ws: PrizeRow[]): string => {
    if (ws.length === 0) return ''
    const w = ws[0]
    const n = (x: number) => Number.isInteger(x) ? `${x}` : x.toFixed(1)
    const split = ws.length > 1 ? ` · tied, split ${ws.length} ways` : ''
    switch (key) {
      case 'overall': return `${n(w.total_points)} total points${split}`
      case 'group_leader': return `${n(gsScore.get(w.user_id) ?? 0)} points in the group stage${split}`
      case 'giant_killer': return `${n(w.giant_killer_points)} points from their Outsider + Lucky Country${split}`
      case 'climber': {
        const c = (gsRank.get(w.user_id) ?? rows.length) - finalRank(w)
        return (c > 0 ? `up ${c} place${c > 1 ? 's' : ''} since the group stage` : 'holding their position so far') + split
      }
      case 'wooden_spoon': return `last on ${n(w.total_points)} points${split}`
      default: return ''
    }
  }

  return PRIZE_BOARD.map(p => ({
    ...p,
    status: statusFor(p.key),
    names: winners[p.key].map(w => w.full_name),
    reason: reasonFor(p.key, winners[p.key]),
  }))
}
