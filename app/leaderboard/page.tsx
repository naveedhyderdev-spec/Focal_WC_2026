import { createServerComponentClient } from '@/lib/supabase/server'
import LeaderboardTable, { type LeaderboardRow } from './LeaderboardTable'
import NextUpdate from './NextUpdate'
import DeadlineBanner from '@/components/DeadlineBanner'
import { PICK_DEADLINE } from '@/lib/config'

export const dynamic = 'force-dynamic'

export default async function LeaderboardPage() {
  const supabase = await createServerComponentClient()
  const [{ data: { user } }, { data: rows, error }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc('get_leaderboard'),
  ])

  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/trophy.png" alt="" aria-hidden className="animate-float mx-auto mb-6 h-28 w-auto" />
      <h1 className="text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">Leaderboard</h1>
      <p className="mt-3 text-center text-sm text-[#a1a1a6]">
        {(rows ?? []).length} players in the game ·{' '}
        <a href="/how-to-play" className="text-[#d2d2d7] underline-offset-4 hover:underline">How to play</a>
      </p>
      <NextUpdate />
      <DeadlineBanner deadlineIso={PICK_DEADLINE.toISOString()} />
      {error ? (
        <p className="mt-12 text-center text-red-400">Could not load the leaderboard. Please refresh.</p>
      ) : (
        <LeaderboardTable rows={(rows ?? []) as LeaderboardRow[]} currentUserId={user?.id ?? null} />
      )}
    </div>
  )
}
