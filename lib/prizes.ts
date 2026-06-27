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
  { key: 'overall', label: 'Overall Champion', amount: 650, schedule: 'After the Final · ~19 July' },
  { key: 'group_leader', label: 'Group Stage Leader', amount: 100, schedule: 'End of group stage · ~28 June' },
  { key: 'giant_killer', label: 'Giant Killer', amount: 100, schedule: 'After the Final · ~19 July' },
  { key: 'climber', label: 'Biggest Climber', amount: 75, schedule: 'After the Final · ~19 July' },
  { key: 'wooden_spoon', label: 'Wooden Spoon', amount: 75, schedule: 'After the Final · ~19 July' },
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
  status: 'won' | 'leading' | 'pending'
  name: string | null
}

export function computePrizes(
  rows: PrizeRow[],
  opts: { groupStageComplete: boolean; tournamentComplete: boolean },
): PrizeResult[] {
  if (rows.length === 0)
    return PRIZE_BOARD.map(p => ({ ...p, status: 'pending' as const, name: null }))

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

  // one prize per person — assign largest amount first
  const awarded = new Set<string>()
  const winner: Record<string, PrizeRow | null> = {}
  for (const p of [...PRIZE_BOARD].sort((a, b) => b.amount - a.amount)) {
    const pick = candidates[p.key].find(r => !awarded.has(r.user_id)) ?? null
    if (pick) awarded.add(pick.user_id)
    winner[p.key] = pick
  }

  const statusFor = (key: string): 'won' | 'leading' | 'pending' => {
    if (key === 'group_leader') return opts.groupStageComplete ? 'won' : 'leading'
    if (key === 'climber') {
      if (opts.tournamentComplete) return 'won'
      return opts.groupStageComplete ? 'leading' : 'pending'
    }
    return opts.tournamentComplete ? 'won' : 'leading'
  }

  return PRIZE_BOARD.map(p => ({
    ...p,
    status: statusFor(p.key),
    name: winner[p.key]?.full_name ?? null,
  }))
}
