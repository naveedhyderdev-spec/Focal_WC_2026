// ============================================================
// Tournament sync logic — pure functions so we can test them
// against a synthetic tournament before real matches start.
// ============================================================
import {
  playerTotal, giantKillerPoints, stageIndex, GROUP_WIN, GROUP_DRAW,
  type PlayerPick, type Slot,
} from '@/lib/scoring'

/** football-data.org codes that differ from ours. */
export const FD_CODE_ALIASES: Record<string, string> = { URY: 'URU' }

export interface FdMatch {
  id: number
  stage: string // GROUP_STAGE/LAST_32/LAST_16/QUARTER_FINALS/SEMI_FINALS/FINAL
  status: string // SCHEDULED/TIMED/IN_PLAY/PAUSED/FINISHED...
  utcDate?: string
  homeTeam: { id?: number; tla?: string | null }
  awayTeam: { id?: number; tla?: string | null }
  score: { winner?: string | null; fullTime: { home: number | null; away: number | null } }
}

export interface TeamStats {
  code: string
  stage_reached: string
  is_eliminated: boolean
  is_champion: boolean
  goals_for: number
  goals_against: number
  games_played: number
  won: number
  draw: number
  lost: number
  group_points: number   // group-stage matches only: wins ×3 + draws ×1
}

const STAGE_ORDER = ['GROUP_STAGE', 'LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL']

export function normalizeCode(tla: string | null | undefined): string | null {
  if (!tla) return null
  return FD_CODE_ALIASES[tla] ?? tla
}

/** Aggregate per-team stats from a list of matches. */
export function aggregateTeams(matches: FdMatch[], allCodes: string[]): Map<string, TeamStats>
{
  const stats = new Map<string, TeamStats>()
  for (const code of allCodes)
    stats.set(code, {
      code, stage_reached: 'GROUP_STAGE', is_eliminated: false, is_champion: false,
      goals_for: 0, goals_against: 0, games_played: 0, won: 0, draw: 0, lost: 0,
      group_points: 0,
    })

  const stageIdx = (s: string) => Math.max(0, STAGE_ORDER.indexOf(s))

  for (const m of matches) {
    const home = normalizeCode(m.homeTeam.tla)
    const away = normalizeCode(m.awayTeam.tla)

    // stage_reached = furthest round a team APPEARS in (scheduled counts)
    for (const code of [home, away]) {
      const t = code ? stats.get(code) : undefined
      if (t && stageIdx(m.stage) > stageIdx(t.stage_reached)) t.stage_reached = m.stage
    }

    // Goals count LIVE (in-play/paused) so the board moves during matches;
    // results (W-D-L, group points) only count once the match is FINISHED.
    const isLive = m.status === 'IN_PLAY' || m.status === 'PAUSED'
    if (m.status !== 'FINISHED' && !isLive) continue
    // a FINISHED/live match with no score is feed garbage — never count it
    // as a 0-0; skip until a source provides the real numbers
    if (m.score.fullTime.home === null || m.score.fullTime.away === null) continue
    const hs = m.score.fullTime.home ?? 0
    const as = m.score.fullTime.away ?? 0
    const ht = home ? stats.get(home) : undefined
    const at = away ? stats.get(away) : undefined
    const isGroup = m.stage === 'GROUP_STAGE'
    if (ht) {
      ht.goals_for += hs; ht.goals_against += as
      if (m.status === 'FINISHED') {
        ht.games_played++
        if (hs > as) { ht.won++; if (isGroup) ht.group_points += GROUP_WIN }
        else if (hs < as) ht.lost++
        else { ht.draw++; if (isGroup) ht.group_points += GROUP_DRAW }
      }
    }
    if (at) {
      at.goals_for += as; at.goals_against += hs
      if (m.status === 'FINISHED') {
        at.games_played++
        if (as > hs) { at.won++; if (isGroup) at.group_points += GROUP_WIN }
        else if (as < hs) at.lost++
        else { at.draw++; if (isGroup) at.group_points += GROUP_DRAW }
      }
    }

    // Champion = winner of the finished Final (knockouts have no DRAW winner)
    if (m.stage === 'FINAL' && m.score.winner && m.score.winner !== 'DRAW') {
      const champCode = m.score.winner === 'HOME_TEAM' ? home : away
      const champ = champCode ? stats.get(champCode) : undefined
      if (champ) champ.is_champion = true
    }
  }

  // Elimination — POSITIVE PROOF ONLY, re-derived every run (never sticky).
  // A team is out only if it actually LOST a finished knockout match, or it
  // failed to qualify from its group once the R32 bracket is fully drawn.
  // This never wrongly eliminates an advancing team whose next-round slot is
  // still TBD/null in the feed (the cause of teams flashing "out").
  const r32 = matches.filter(m => m.stage === 'LAST_32')
  const r32FullyDrawn = r32.length >= 16 &&
    r32.every(m => normalizeCode(m.homeTeam.tla) && normalizeCode(m.awayTeam.tla))
  const knockoutLosers = new Set<string>()
  for (const m of matches) {
    if (m.stage === 'GROUP_STAGE' || m.status !== 'FINISHED') continue
    const w = m.score.winner
    if (!w || w === 'DRAW') continue // a finished knockout always has a decisive winner
    const loser = w === 'HOME_TEAM' ? normalizeCode(m.awayTeam.tla) : normalizeCode(m.homeTeam.tla)
    if (loser) knockoutLosers.add(loser)
  }
  for (const t of stats.values()) {
    t.is_eliminated =
      knockoutLosers.has(t.code) ||                          // lost a knockout tie
      (r32FullyDrawn && stageIdx(t.stage_reached) === 0)     // never made the knockouts
  }
  return stats
}

export interface UserPickRow {
  user_id: string
  slot: Slot
  team_code: string
}

export interface UserScore {
  total_points: number
  total_goals: number
  giant_killer_points: number
  lucky_stage: number   // tiebreaker 1: how far the lucky team got
  c_stage: number       // tiebreaker 2: how far the Tier C team got
}

/** Recompute every player's totals, Giant Killer sub-total, and tiebreaker keys. */
export function computeScores(
  picks: UserPickRow[],
  stats: Map<string, TeamStats>,
): Map<string, UserScore> {
  const byUser = new Map<string, UserPickRow[]>()
  for (const p of picks) byUser.set(p.user_id, [...(byUser.get(p.user_id) ?? []), p])

  const teamStage = (t: TeamStats | undefined) =>
    t?.is_champion ? stageIndex('FINAL') + 1 : stageIndex(t?.stage_reached ?? 'GROUP_STAGE')

  const out = new Map<string, UserScore>()
  for (const [userId, userPicks] of byUser) {
    const playerPicks: PlayerPick[] = userPicks.map(p => {
      const t = stats.get(p.team_code)
      return {
        slot: p.slot,
        team: {
          stage_reached: t?.stage_reached ?? 'GROUP_STAGE',
          is_champion: t?.is_champion ?? false,
          group_points: t?.group_points ?? 0,
        },
      }
    })
    const total_goals = userPicks.reduce((s, p) => s + (stats.get(p.team_code)?.goals_for ?? 0), 0)
    out.set(userId, {
      total_points: playerTotal(playerPicks),
      total_goals,
      giant_killer_points: giantKillerPoints(playerPicks),
      lucky_stage: teamStage(stats.get(userPicks.find(p => p.slot === 'lucky')?.team_code ?? '')),
      c_stage: teamStage(stats.get(userPicks.find(p => p.slot === 'C')?.team_code ?? '')),
    })
  }
  return out
}

// ---------- change detection (powers the "Last updated" status) ----------

export interface PrevMatch { status: string; home_score: number | null; away_score: number | null }
export interface PrevTeam { stage_reached: string | null; is_champion: boolean }

const CHANGE_STAGE_LABEL: Record<string, string> = {
  LAST_32: 'Round of 32', LAST_16: 'Round of 16', QUARTER_FINALS: 'Quarter-final',
  SEMI_FINALS: 'Semi-final', FINAL: 'the Final',
}

/** Human summary of what changed vs the previous DB state. Empty = nothing changed. */
export function detectChanges(
  matches: FdMatch[],
  prevMatches: Map<number, PrevMatch>,
  stats: Iterable<TeamStats>,
  prevTeams: Map<string, PrevTeam>,
  nameOf: (code: string | null) => string,
): string[] {
  const out: string[] = []
  for (const m of matches) {
    const prev = prevMatches.get(m.id)
    if (!prev) continue
    const hs = m.score.fullTime.home, as = m.score.fullTime.away
    // Only an INCREASE (a real goal) or full-time counts as a change — never a
    // transient downward wobble (scores are ratcheted, but guard here too).
    const scoreUp = (hs ?? -1) > (prev.home_score ?? -1) || (as ?? -1) > (prev.away_score ?? -1)
    const becameFinished = m.status === 'FINISHED' && prev.status !== 'FINISHED'
    if ((scoreUp || becameFinished) && hs !== null && as !== null) {
      const label = `${nameOf(normalizeCode(m.homeTeam.tla))} ${hs}–${as} ${nameOf(normalizeCode(m.awayTeam.tla))}`
      out.push(becameFinished ? `${label} (full-time)` : `${label} (live)`)
    }
  }
  for (const t of stats) {
    const prev = prevTeams.get(t.code)
    if (!prev) continue
    if (t.is_champion && !prev.is_champion) out.push(`${nameOf(t.code)} won the World Cup! 🏆`)
    else if (prev.stage_reached && stageIndex(t.stage_reached) > stageIndex(prev.stage_reached))
      out.push(`${nameOf(t.code)} reached ${CHANGE_STAGE_LABEL[t.stage_reached] ?? t.stage_reached}`)
  }
  return out
}
