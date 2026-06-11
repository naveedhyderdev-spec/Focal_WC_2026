import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { aggregateTeams, computeScores, normalizeCode, type FdMatch } from '@/lib/sync'

const FD_BASE = 'https://api.football-data.org/v4'
const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard'

// ESPN team names that differ from ours (most match exactly)
const ESPN_NAME_ALIASES: Record<string, string> = {
  'Turkey': 'Türkiye',
  'Cape Verde Islands': 'Cabo Verde',
  'Cape Verde': 'Cabo Verde',
  "Côte d'Ivoire": 'Ivory Coast',
  'Democratic Republic of the Congo': 'DR Congo',
  'USA': 'United States',
  'Czech Republic': 'Czechia',
  'Bosnia & Herzegovina': 'Bosnia and Herzegovina',
}

// Daily sync (Vercel Cron, midnight Dubai). Protected by CRON_SECRET.
// 3 football-data calls (teams, matches, standings) — well under 10/min.
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const fdHeaders = { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY! }
  const admin = createAdminClient()

  const fd = async (path: string) => {
    const res = await fetch(`${FD_BASE}${path}`, { headers: fdHeaders, cache: 'no-store' })
    if (!res.ok) throw new Error(`football-data ${path} → ${res.status}`)
    return res.json()
  }

  try {
    // 1. Map fd team ids → our team codes
    const fdTeams = await fd('/competitions/WC/teams')
    const { data: ourTeams, error: teamsErr } = await admin.from('teams').select('id, code, tier')
    if (teamsErr || !ourTeams) throw new Error(`teams read: ${teamsErr?.message}`)
    const codeToTeam = new Map(ourTeams.map(t => [t.code, t]))

    for (const ft of fdTeams.teams ?? []) {
      const code = normalizeCode(ft.tla)
      const ours = code ? codeToTeam.get(code) : undefined
      if (ours) await admin.from('teams').update({ fd_team_id: ft.id }).eq('id', ours.id)
    }

    // 2. Upsert all matches
    const fdMatches = await fd('/competitions/WC/matches')
    let matches: FdMatch[] = fdMatches.matches ?? []

    // 2a. ESPN live overlay — football-data's free live feed can freeze for
    // an entire match. ESPN's public scoreboard is fast; where it is AHEAD
    // (live or finished while fd still says scheduled), its state wins.
    // Non-fatal: any failure here just means we rely on fd alone.
    try {
      const nameToCode = new Map(ourTeams.map(t => [t.code, t.code]))
      const { data: teamNames } = await admin.from('teams').select('code, name')
      for (const t of teamNames ?? []) nameToCode.set(t.name, t.code)
      for (const [espn, ours] of Object.entries(ESPN_NAME_ALIASES)) {
        const code = (teamNames ?? []).find(t => t.name === ours)?.code
        if (code) nameToCode.set(espn, code)
      }

      const espnRes = await fetch(ESPN_SCOREBOARD, { cache: 'no-store' })
      if (espnRes.ok) {
        const espn = await espnRes.json()
        // key: "HOME|AWAY" codes → { state, home, away }
        const overlay = new Map<string, { state: string; home: number; away: number }>()
        for (const e of espn.events ?? []) {
          const comp = e.competitions?.[0]
          const state = e.status?.type?.state // pre | in | post
          if (!comp || state === 'pre') continue
          let homeCode: string | undefined, awayCode: string | undefined
          let homeScore = 0, awayScore = 0
          for (const c of comp.competitors ?? []) {
            const code = nameToCode.get(c.team?.displayName)
            if (!code) continue
            if (c.homeAway === 'home') { homeCode = code; homeScore = Number(c.score ?? 0) }
            else { awayCode = code; awayScore = Number(c.score ?? 0) }
          }
          if (homeCode && awayCode)
            overlay.set(`${homeCode}|${awayCode}`, { state, home: homeScore, away: awayScore })
        }

        const OVERLAY_RANK: Record<string, number> = { in: 1, post: 2 }
        matches = matches.map(m => {
          const h = normalizeCode(m.homeTeam.tla)
          const a = normalizeCode(m.awayTeam.tla)
          const o = h && a ? overlay.get(`${h}|${a}`) : undefined
          if (!o) return m
          const fdRank = m.status === 'FINISHED' ? 2 : (m.status === 'IN_PLAY' || m.status === 'PAUSED') ? 1 : 0
          const fdHasScore = m.score.fullTime.home !== null && m.score.fullTime.away !== null
          // fd wins only if it's at least as advanced AND actually has a score
          if ((OVERLAY_RANK[o.state] ?? 0) <= fdRank && fdHasScore) return m
          const finished = o.state === 'post'
          return {
            ...m,
            status: finished ? 'FINISHED' : 'IN_PLAY',
            score: {
              winner: finished ? (o.home > o.away ? 'HOME_TEAM' : o.away > o.home ? 'AWAY_TEAM' : 'DRAW') : null,
              fullTime: { home: o.home, away: o.away },
            },
          }
        })
      }
    } catch (e) {
      console.error('ESPN overlay skipped:', e)
    }

    // Guard against feed glitches: football-data occasionally reverts a
    // live/finished match to TIMED with null scores for a few minutes.
    // Never let a match regress — keep our last-known state instead.
    const RANK: Record<string, number> = {
      SCHEDULED: 0, TIMED: 0, IN_PLAY: 1, PAUSED: 1, FINISHED: 2,
    }
    const { data: existingRows } = await admin
      .from('matches').select('fd_match_id, status, home_score, away_score, winner')
    const existing = new Map((existingRows ?? []).map(r => [r.fd_match_id, r]))
    matches = matches.map(m => {
      const prev = existing.get(m.id)
      if (!prev) return m
      // status regression → keep our last-known state entirely
      if ((RANK[m.status] ?? 0) < (RANK[prev.status] ?? 0)) {
        return {
          ...m,
          status: prev.status,
          score: {
            winner: prev.winner,
            fullTime: { home: prev.home_score, away: prev.away_score },
          },
        }
      }
      // status advanced but score went missing (e.g. FINISHED with nulls
      // while we held a real live score) → keep our last-known score
      if (m.score.fullTime.home === null && m.score.fullTime.away === null
          && prev.home_score !== null && prev.away_score !== null) {
        const h = prev.home_score, a = prev.away_score
        return {
          ...m,
          score: {
            winner: m.status === 'FINISHED'
              ? (h > a ? 'HOME_TEAM' : a > h ? 'AWAY_TEAM' : 'DRAW')
              : prev.winner,
            fullTime: { home: h, away: a },
          },
        }
      }
      return m
    })

    if (matches.length > 0) {
      const rows = matches.map(m => ({
        fd_match_id: m.id,
        stage: m.stage,
        status: m.status,
        utc_date: m.utcDate ?? null,
        home_team_code: normalizeCode(m.homeTeam.tla),
        away_team_code: normalizeCode(m.awayTeam.tla),
        home_score: m.score.fullTime.home,
        away_score: m.score.fullTime.away,
        winner: m.score.winner ?? null,
        updated_at: new Date().toISOString(),
      }))
      const { error } = await admin.from('matches').upsert(rows, { onConflict: 'fd_match_id' })
      if (error) throw new Error(`matches upsert: ${error.message}`)
    }

    // 3. Aggregate team stats + group positions from standings
    const stats = aggregateTeams(matches, ourTeams.map(t => t.code))

    const groupPos = new Map<string, number>()
    try {
      const standings = await fd('/competitions/WC/standings')
      for (const s of standings.standings ?? [])
        if (s.type === 'TOTAL')
          for (const row of s.table ?? []) {
            const code = normalizeCode(row.team?.tla)
            if (code) groupPos.set(code, row.position)
          }
    } catch { /* standings may 404 before kickoff — not fatal */ }

    for (const t of stats.values()) {
      const ours = codeToTeam.get(t.code)
      if (!ours) continue
      const { error } = await admin.from('teams').update({
        stage_reached: t.stage_reached,
        is_eliminated: t.is_eliminated,
        is_champion: t.is_champion,
        eliminated_at: t.is_eliminated ? new Date().toISOString() : null,
        goals_for: t.goals_for,
        goals_against: t.goals_against,
        games_played: t.games_played,
        won: t.won, draw: t.draw, lost: t.lost,
        group_points: t.group_points,
        group_position: groupPos.get(t.code) ?? null,
      }).eq('id', ours.id)
      if (error) throw new Error(`team ${t.code} update: ${error.message}`)
    }

    // 4. Recompute all scores + ranks
    const { data: pickRows, error: picksErr } = await admin
      .from('picks').select('user_id, slot, teams(code)')
    if (picksErr) throw new Error(`picks read: ${picksErr.message}`)

    const flat = (pickRows ?? []).map(p => {
      const t = Array.isArray(p.teams) ? p.teams[0] : p.teams
      return {
        user_id: p.user_id,
        slot: p.slot as 'A' | 'B' | 'C' | 'lucky',
        team_code: (t as { code: string } | null)?.code ?? '',
      }
    })
    const totals = computeScores(flat, stats)

    // Rank with the official tiebreakers: points, then how far the lucky
    // team got, then how far the Tier C team got; still level = shared rank.
    const ranked = [...totals.entries()].sort((a, b) =>
      b[1].total_points - a[1].total_points ||
      b[1].lucky_stage - a[1].lucky_stage ||
      b[1].c_stage - a[1].c_stage)
    let rank = 0
    let prev: { total_points: number; lucky_stage: number; c_stage: number } | null = null
    const scoreRows = ranked.map(([user_id, t], i) => {
      if (!prev || t.total_points !== prev.total_points || t.lucky_stage !== prev.lucky_stage || t.c_stage !== prev.c_stage) {
        rank = i + 1
        prev = t
      }
      return {
        user_id,
        total_points: t.total_points,
        total_goals: t.total_goals,
        giant_killer_points: t.giant_killer_points,
        current_rank: rank,
        updated_at: new Date().toISOString(),
      }
    })
    if (scoreRows.length > 0) {
      const { error } = await admin.from('scores').upsert(scoreRows, { onConflict: 'user_id' })
      if (error) throw new Error(`scores upsert: ${error.message}`)
    }

    return NextResponse.json({
      ok: true,
      matches: matches.length,
      players_scored: scoreRows.length,
    })
  } catch (e) {
    console.error('cron sync failed:', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
