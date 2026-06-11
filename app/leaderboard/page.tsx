import { createServerComponentClient } from '@/lib/supabase/server'
import LeaderboardTable, { type LeaderboardRow } from './LeaderboardTable'
import NextUpdate from './NextUpdate'
import DeadlineBanner from '@/components/DeadlineBanner'
import MatchStrip, { type MatchLite } from './MatchStrip'
import AutoRefresh from './AutoRefresh'
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
  const [{ data: { user } }, { data: rows, error }, { data: todayMatches }, { data: teams }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc('get_leaderboard'),
    supabase.from('matches')
      .select('fd_match_id, status, utc_date, home_team_code, away_team_code, home_score, away_score')
      .gte('utc_date', start).lt('utc_date', end).order('utc_date'),
    supabase.from('teams').select('code, name'),
  ])

  const names = Object.fromEntries((teams ?? []).map(t => [t.code, t.name]))
  // LIVE = official kickoff has passed and we're inside the realistic match
  // window — same clock-based rule as the match strip (the feed's live
  // status is unreliable; FINISHED from the feed always ends it early).
  const now = Date.now()
  const liveCodes = (todayMatches ?? [])
    .filter(m => {
      if (m.status === 'FINISHED' || !m.utc_date) return false
      const ko = new Date(m.utc_date).getTime()
      return now >= ko && now <= ko + 130 * 60_000
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
      <NextUpdate />
      <DeadlineBanner deadlineIso={PICK_DEADLINE.toISOString()} />
      <MatchStrip matches={(todayMatches ?? []) as MatchLite[]} names={names} />
      {error ? (
        <p className="mt-12 text-center text-red-400">Could not load the leaderboard. Please refresh.</p>
      ) : (
        <LeaderboardTable rows={(rows ?? []) as LeaderboardRow[]} currentUserId={user?.id ?? null} liveCodes={liveCodes} />
      )}
    </div>
  )
}
