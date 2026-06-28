import { createServerComponentClient } from '@/lib/supabase/server'
import LeaderboardTable, { type LeaderboardRow } from './LeaderboardTable'
import SyncStatus from './SyncStatus'
import DeadlineBanner from '@/components/DeadlineBanner'
import MatchStrip, { liveWindowMin, type MatchLite } from './MatchStrip'
import AutoRefresh from './AutoRefresh'
import WinnerBoard from './WinnerBoard'
import { computePrizes, type PrizeRow } from '@/lib/prizes'
import { PICK_DEADLINE } from '@/lib/config'

export const dynamic = 'force-dynamic'

/** Match-strip window: from 10h ago through the end of today in Dubai —
 *  so a match that kicked off before midnight stays visible (with its
 *  score) until well after it finishes, plus everything later today. */
function matchWindow(): { start: string; end: string } {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date()) // YYYY-MM-DD
  const endOfToday = new Date(new Date(`${today}T00:00:00+04:00`).getTime() + 24 * 3600 * 1000)
  const start = new Date(Date.now() - 10 * 3600 * 1000)
  return { start: start.toISOString(), end: endOfToday.toISOString() }
}

export default async function LeaderboardPage() {
  const supabase = await createServerComponentClient()
  const { start, end } = matchWindow()
  const [{ data: { user } }, { data: rows, error }, { data: todayMatches }, { data: teams }, syncMetaRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc('get_leaderboard'),
    supabase.from('matches')
      .select('fd_match_id, stage, status, utc_date, home_team_code, away_team_code, home_score, away_score')
      .gte('utc_date', start).lt('utc_date', end).order('utc_date'),
    supabase.from('teams').select('code, name, stage_reached, is_champion'),
    // sync status — graceful if the table isn't migrated yet
    supabase.from('sync_meta').select('last_run_at, last_change_at, changed, summary').eq('id', 1).maybeSingle(),
  ])
  const meta = syncMetaRes?.data ?? null

  const names = Object.fromEntries((teams ?? []).map(t => [t.code, t.name]))
  // Tournament phase drives the Winner Board: group stage is over once any
  // team has advanced past it; the tournament is over once a champion exists.
  const groupStageComplete = (teams ?? []).some(t => t.stage_reached && t.stage_reached !== 'GROUP_STAGE')
  const tournamentComplete = (teams ?? []).some(t => t.is_champion)
  const prizes = computePrizes((rows ?? []) as PrizeRow[], { groupStageComplete, tournamentComplete })
  // LIVE = official kickoff has passed and we're inside the realistic match
  // window — same clock-based rule as the match strip (the feed's live
  // status is unreliable; FINISHED from the feed always ends it early).
  const now = Date.now()
  const liveCodes = (todayMatches ?? [])
    .filter(m => {
      if (m.status === 'FINISHED' || !m.utc_date) return false
      const ko = new Date(m.utc_date).getTime()
      return now >= ko && now <= ko + liveWindowMin(m.stage) * 60_000
    })
    .flatMap(m => [m.home_team_code, m.away_team_code])
    .filter((c): c is string => !!c)

  return (
    <div>
      <AutoRefresh />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/trophy.png" alt="" aria-hidden className="animate-float mx-auto mb-6 h-28 w-auto" />
      <h1 className="text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">Leaderboard</h1>
      <p className="mt-3 text-center text-sm text-[#a1a1a6]">
        {(rows ?? []).length} players in the game ·{' '}
        <a href="/how-to-play" className="text-[#d2d2d7] underline-offset-4 hover:underline">How to play</a>
      </p>
      <SyncStatus
        lastRunAt={meta?.last_run_at ?? null}
        lastChangeAt={meta?.last_change_at ?? null}
        lastRunChanged={meta?.changed ?? false}
        summary={(meta?.summary as string[]) ?? []}
      />
      <DeadlineBanner deadlineIso={PICK_DEADLINE.toISOString()} />
      <MatchStrip matches={(todayMatches ?? []) as MatchLite[]} names={names} />
      {!error && <WinnerBoard prizes={prizes} />}
      {error ? (
        <p className="mt-12 text-center text-red-400">Could not load the leaderboard. Please refresh.</p>
      ) : (
        <LeaderboardTable rows={(rows ?? []) as LeaderboardRow[]} currentUserId={user?.id ?? null} liveCodes={liveCodes} />
      )}
    </div>
  )
}
