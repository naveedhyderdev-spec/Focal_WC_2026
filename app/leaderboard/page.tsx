import { createServerComponentClient } from '@/lib/supabase/server'
import LeaderboardTable, { type LeaderboardRow } from './LeaderboardTable'

export const dynamic = 'force-dynamic'

export default async function LeaderboardPage() {
  const supabase = await createServerComponentClient()
  const [{ data: { user } }, { data: rows, error }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc('get_leaderboard'),
  ])

  return (
    <div>
      <h1 className="text-center text-3xl font-normal tracking-tight text-white sm:text-4xl">Leaderboard</h1>
      <p className="mt-3 text-center text-sm text-[#9AA7CC]">
        Updated daily as the tournament progresses ·{' '}
        <a href="/how-to-play" className="text-[#C5CFE8] underline-offset-4 hover:underline">How to play</a>
      </p>
      {error ? (
        <p className="mt-12 text-center text-red-400">Could not load the leaderboard. Please refresh.</p>
      ) : (
        <LeaderboardTable rows={(rows ?? []) as LeaderboardRow[]} currentUserId={user?.id ?? null} />
      )}
    </div>
  )
}
