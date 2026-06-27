import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { aggregateTeams, computeScores, normalizeCode, type FdMatch } from '@/lib/sync'
import { stageIndex } from '@/lib/scoring'

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
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

  // Retry transient football-data failures (5xx, 429, network) up to 3x with
  // backoff so a momentary blip doesn't fail the whole sync.
  const fd = async (path: string) => {
    let lastErr: unknown
    for (let attempt = 0; attempt < 3; attempt++) {
      let res: Response
      try {
        res = await fetch(`${FD_BASE}${path}`, { headers: fdHeaders, cache: 'no-store' })
      } catch (e) {
        lastErr = e
        await sleep(300 * (attempt + 1))
        continue
      }
      if (res.ok) return res.json()
      lastErr = new Error(`football-data ${path} → ${res.status}`)
      if (res.status >= 500 || res.status === 429) {
        await sleep(300 * (attempt + 1))
        continue
      }
      throw lastErr // 4xx (e.g. standings 404 pre-tournament) — don't retry
    }
    throw lastErr
  }

  try {
    // 1. Map fd team ids → our team codes
    const fdTeams = await fd('/competitions/WC/teams')
    const { data: ourTeams, error: teamsErr } = await admin.from('teams').select('id, code, tier, name')
    if (teamsErr || !ourTeams) throw new Error(`teams read: ${teamsErr?.message}`)
    const codeToTeam = new Map(ourTeams.map(t => [t.code, t]))
    const codeName = (c: string | null) => (c ? codeToTeam.get(c)?.name ?? c : '?')

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
      .from('matches').select('fd_match_id, status, home_team_code, away_team_code, home_score, away_score, winner')
    const existing = new Map((existingRows ?? []).map(r => [r.fd_match_id, r]))
    matches = matches.map(m => {
      const prev = existing.get(m.id)
      if (!prev) return m
      let status = m.status
      let home = m.score.fullTime.home
      let away = m.score.fullTime.away
      let winner = m.score.winner ?? null
      // status regression → keep our last-known status + score
      if ((RANK[m.status] ?? 0) < (RANK[prev.status] ?? 0)) {
        status = prev.status; home = prev.home_score; away = prev.away_score; winner = prev.winner
      } else if (home === null && away === null && prev.home_score !== null && prev.away_score !== null) {
        // status held/advanced but score went missing → keep last-known score
        home = prev.home_score; away = prev.away_score
        winner = status === 'FINISHED' ? (home! > away! ? 'HOME_TEAM' : away! > home! ? 'AWAY_TEAM' : 'DRAW') : prev.winner
      }
      // NEVER overwrite a known knockout-bracket team with null. The live feed
      // intermittently drops the R32+ team names (showing them as TBD/null),
      // which was wiping the bracket and flickering the leaderboard.
      const homeTla = (normalizeCode(m.homeTeam.tla) ?? prev.home_team_code) as string | null
      const awayTla = (normalizeCode(m.awayTeam.tla) ?? prev.away_team_code) as string | null
      return {
        ...m,
        status,
        homeTeam: { ...m.homeTeam, tla: homeTla },
        awayTeam: { ...m.awayTeam, tla: awayTla },
        score: { winner, fullTime: { home, away } },
      }
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

    // 3. Aggregate team stats from the FULL matches table (not just this
    // response). The matches table is the merged best-known truth — protected
    // by the per-match guard above and never reduced by upserts. Computing
    // from it means a partial/empty/degraded API response can NEVER zero out
    // team stats, which was the cause of the leaderboard flicker.
    const { data: allMatchRows, error: allMatchErr } = await admin
      .from('matches')
      .select('fd_match_id, stage, status, utc_date, home_team_code, away_team_code, home_score, away_score, winner')
    if (allMatchErr) throw new Error(`matches read: ${allMatchErr.message}`)
    const matchesForAgg: FdMatch[] = (allMatchRows ?? []).map(r => ({
      id: r.fd_match_id,
      stage: r.stage,
      status: r.status,
      utcDate: r.utc_date ?? undefined,
      homeTeam: { tla: r.home_team_code },
      awayTeam: { tla: r.away_team_code },
      score: { winner: r.winner, fullTime: { home: r.home_score, away: r.away_score } },
    }))
    const stats = aggregateTeams(matchesForAgg, ourTeams.map(t => t.code))

    // Per-team NO-REGRESSION guard — the final safety net. Read current team
    // rows and never let a stat go BACKWARDS: cumulative counts only rise,
    // stage only advances, eliminated/champion are sticky, group_position is
    // kept if standings degrade. So even if a feed glitch slips through every
    // earlier guard, scores and stages can only ever move forward. This (with
    // the match-table guards above) is what stops the leaderboard flicker.
    const { data: existingTeams } = await admin.from('teams').select(
      'code, goals_for, goals_against, games_played, won, draw, lost, group_points, stage_reached, is_eliminated, is_champion, group_position')
    const existing2 = new Map((existingTeams ?? []).map(t => [t.code, t]))
    for (const t of stats.values()) {
      const p = existing2.get(t.code)
      if (!p) continue
      t.goals_for = Math.max(t.goals_for, p.goals_for ?? 0)
      t.goals_against = Math.max(t.goals_against, p.goals_against ?? 0)
      t.games_played = Math.max(t.games_played, p.games_played ?? 0)
      t.won = Math.max(t.won, p.won ?? 0)
      t.draw = Math.max(t.draw, p.draw ?? 0)
      t.lost = Math.max(t.lost, p.lost ?? 0)
      t.group_points = Math.max(t.group_points, p.group_points ?? 0)
      if (p.stage_reached && stageIndex(p.stage_reached) > stageIndex(t.stage_reached))
        t.stage_reached = p.stage_reached
      t.is_eliminated = t.is_eliminated || !!p.is_eliminated
      t.is_champion = t.is_champion || !!p.is_champion
    }

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

    // Detect WHAT actually changed this run (for the "Last updated" status).
    const STAGE_LABEL: Record<string, string> = {
      LAST_32: 'Round of 32', LAST_16: 'Round of 16', QUARTER_FINALS: 'Quarter-final',
      SEMI_FINALS: 'Semi-final', FINAL: 'the Final',
    }
    const changeSummary: string[] = []
    // match score/status changes (incl. live goals and full-time results)
    for (const m of matches) {
      const prev = existing.get(m.id)
      const hs = m.score.fullTime.home, as = m.score.fullTime.away
      if (!prev) continue
      const scoreChanged = hs !== prev.home_score || as !== prev.away_score
      const becameFinished = m.status === 'FINISHED' && prev.status !== 'FINISHED'
      if ((scoreChanged || becameFinished) && hs !== null && as !== null) {
        const label = `${codeName(normalizeCode(m.homeTeam.tla))} ${hs}–${as} ${codeName(normalizeCode(m.awayTeam.tla))}`
        changeSummary.push(becameFinished ? `${label} (full-time)` : `${label} (live)`)
      }
    }
    // teams advancing a round / winning the cup
    for (const t of stats.values()) {
      const prev = existing2.get(t.code)
      if (!prev) continue
      if (t.is_champion && !prev.is_champion) changeSummary.push(`${codeName(t.code)} won the World Cup! 🏆`)
      else if (prev.stage_reached && stageIndex(t.stage_reached) > stageIndex(prev.stage_reached))
        changeSummary.push(`${codeName(t.code)} reached ${STAGE_LABEL[t.stage_reached] ?? t.stage_reached}`)
    }
    const didChange = changeSummary.length > 0

    // Write all teams in parallel so the table updates near-atomically — a
    // leaderboard read can no longer catch a half-updated set of teams.
    await Promise.all([...stats.values()].map(async t => {
      const ours = codeToTeam.get(t.code)
      if (!ours) return
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
        group_position: groupPos.get(t.code) ?? existing2.get(t.code)?.group_position ?? null,
      }).eq('id', ours.id)
      if (error) throw new Error(`team ${t.code} update: ${error.message}`)
    }))

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

    // 5. Record sync metadata for the "Last updated" status. last_run_at bumps
    // every run (proves the system is alive); last_change_at + summary only bump
    // when something ACTUALLY changed. Non-fatal: if the table isn't there yet
    // (migration not run), we skip silently rather than failing the sync.
    const nowIso = new Date().toISOString()
    try {
      const meta: Record<string, unknown> = { id: 1, last_run_at: nowIso, changed: didChange }
      if (didChange) {
        meta.last_change_at = nowIso
        meta.summary = changeSummary.slice(0, 8)
      }
      await admin.from('sync_meta').upsert(meta, { onConflict: 'id' })
    } catch (e) {
      console.error('sync_meta write skipped:', e)
    }

    return NextResponse.json({
      ok: true,
      matches: matches.length,
      players_scored: scoreRows.length,
      changed: didChange,
      changes: changeSummary.slice(0, 8),
    })
  } catch (e) {
    console.error('cron sync failed:', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
