// ============================================================
// SCORING — FINAL rules. Every tunable number is here.
// Changing values and re-running the daily sync recomputes
// everyone's score retroactively.
// ============================================================

/** Group-stage match points (group matches ONLY). */
export const GROUP_WIN = 3
export const GROUP_DRAW = 1

/** Knockout points for the FURTHEST round reached (not cumulative). */
export const KNOCKOUT_POINTS: Record<string, number> = {
  GROUP_STAGE: 0,
  LAST_32: 5,
  LAST_16: 12,
  QUARTER_FINALS: 22,
  SEMI_FINALS: 36,
  FINAL: 55,
  WINNER: 85,
}

/** Slot multipliers. The lucky team is ALWAYS ×1.5 regardless of its own tier. */
export type Slot = 'A' | 'B' | 'C' | 'lucky'
export const SLOT_MULTIPLIER: Record<Slot, number> = { A: 1, B: 1.5, C: 2.5, lucky: 1.5 }

/** Lucky Country bonuses (lucky team only). */
export const LUCKY_QF_BONUS = 25   // reaches Quarter-final or beyond
export const LUCKY_JACKPOT = 50    // wins the Cup

export const SLOT_LABEL: Record<Slot, string> = {
  A: 'Favourite', B: 'Contender', C: 'Outsider', lucky: 'Lucky',
}
export type Tier = 'A' | 'B' | 'C'
export const TIER_LABEL: Record<Tier, string> = {
  A: 'Tier A · Favourites', B: 'Tier B · Contenders', C: 'Tier C · Outsiders',
}

/** Prize pot: $1,000 split across five prizes, ONE prize per person —
 *  if someone tops two categories they take the larger, the smaller passes
 *  to the next eligible player. Amounts from the official deck. */
export const PRIZES: { key: string; label: string; amount: number }[] = [
  { key: 'overall', label: 'Overall Champion', amount: 650 },
  { key: 'group_leader', label: 'Group Stage Leader', amount: 100 },
  { key: 'giant_killer', label: 'Giant Killer', amount: 100 },
  { key: 'climber', label: 'Biggest Climber', amount: 75 },
  { key: 'wooden_spoon', label: 'Wooden Spoon', amount: 75 },
]

/** Show the live prize-holders strip on the leaderboard. Off for the early
 *  group stage (everyone's tied — naming "winners" is noise); flip to true
 *  once the table spreads out, e.g. late group stage. */
export const SHOW_PRIZE_STRIP = false

export const PRIZE_TEXT =
  'Five prizes share the $1,000 pot: Overall Champion, Group Stage Leader, Giant Killer ' +
  '(most points from your Outsider + Lucky Country), Biggest Climber after the group stage, ' +
  'and the Wooden Spoon for last place. One prize per person — top two categories and you ' +
  'take the larger one.'

// ---------- calculation ----------

const STAGE_ORDER = ['GROUP_STAGE', 'LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL']
export const stageIndex = (s: string) => Math.max(0, STAGE_ORDER.indexOf(s))

export interface ScorableTeam {
  stage_reached: string
  is_champion: boolean
  group_points: number
}

export function knockoutPoints(team: ScorableTeam): number {
  if (team.is_champion) return KNOCKOUT_POINTS.WINNER
  return KNOCKOUT_POINTS[team.stage_reached] ?? 0
}

/** (group points + knockout points) × slot multiplier. Excludes lucky bonuses. */
export function teamScore(team: ScorableTeam, slot: Slot): number {
  return (team.group_points + knockoutPoints(team)) * SLOT_MULTIPLIER[slot]
}

/** +25 if the lucky team reaches the QF or beyond, +50 if it wins the Cup. */
export function luckyBonus(team: ScorableTeam): number {
  let bonus = 0
  const reachedQF = team.is_champion || stageIndex(team.stage_reached) >= stageIndex('QUARTER_FINALS')
  if (reachedQF) bonus += LUCKY_QF_BONUS
  if (team.is_champion) bonus += LUCKY_JACKPOT
  return bonus
}

export interface PlayerPick {
  slot: Slot
  team: ScorableTeam
}

/** Player total = Σ team scores + lucky bonuses. */
export function playerTotal(picks: PlayerPick[]): number {
  return picks.reduce((sum, p) =>
    sum + teamScore(p.team, p.slot) + (p.slot === 'lucky' ? luckyBonus(p.team) : 0), 0)
}

/** Giant Killer sub-total: points from the Tier C pick + the Lucky Country (incl. bonuses). */
export function giantKillerPoints(picks: PlayerPick[]): number {
  return picks
    .filter(p => p.slot === 'C' || p.slot === 'lucky')
    .reduce((sum, p) => sum + teamScore(p.team, p.slot) + (p.slot === 'lucky' ? luckyBonus(p.team) : 0), 0)
}
