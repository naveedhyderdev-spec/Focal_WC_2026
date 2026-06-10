import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { aggregateTeams, computeScores, normalizeCode, type FdMatch } from '@/lib/sync'

const FD_BASE = 'https://api.football-data.org/v4'

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
    const matches: FdMatch[] = fdMatches.matches ?? []
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
