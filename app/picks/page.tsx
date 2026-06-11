import { redirect } from 'next/navigation'
import { createServerComponentClient } from '@/lib/supabase/server'
import { formatDeadline, isDeadlinePassed, PICK_DEADLINE } from '@/lib/config'
import Countdown from './Countdown'
import PickBoard, { type Team } from './PickBoard'
import LockedPicks from './LockedPicks'
import type { Slot } from '@/lib/scoring'

const ERRORS: Record<string, string> = {
  deadline: 'The deadline has passed — picks are closed.',
  invalid: 'Something was wrong with your selection. Pick one team from each tier.',
  locked: 'Your picks are already locked in.',
  server: 'Something went wrong on our side. Please try again.',
}

export default async function PicksPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createServerComponentClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await searchParams

  const [{ data: teams }, { data: myPicks }] = await Promise.all([
    supabase.from('teams').select('id, name, code, flag, group_letter, tier').order('name'),
    supabase.from('picks').select('slot, team_id').eq('user_id', user.id),
  ])

  if (myPicks && myPicks.length > 0) {
    return <LockedPicks picks={myPicks as { slot: Slot; team_id: number }[]} teams={(teams ?? []) as Team[]} />
  }

  return (
    <div>
      <div className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ball.png" alt="" aria-hidden style={{clipPath: "circle(47%)"}}
          className="animate-ballroll mx-auto mb-5 h-20 w-20" />
        <h1 className="animate-risein text-3xl font-semibold tracking-tight text-white sm:text-4xl">Build Your Squad</h1>
        <p className="mt-3 text-sm text-[#a1a1a6]">
          One Favourite, one Contender, one Outsider — plus a random Lucky Country · picks lock at{' '}
          <span className="text-[#d2d2d7]">{formatDeadline()}</span>
        </p>
        <Countdown deadlineIso={PICK_DEADLINE.toISOString()} />
        <a href="/how-to-play"
          className="mt-5 inline-block rounded-lg border border-[#5a5a5e] px-8 py-3 font-medium text-white transition hover:border-[#86868b] hover:bg-[#161618]">
          How to Play — rules &amp; prizes
        </a>
      </div>

      {error && ERRORS[error] && (
        <div className="mx-auto mt-6 max-w-xl rounded border border-red-900/60 bg-red-950/30 px-4 py-3 text-center text-sm text-red-300">
          {ERRORS[error]}
        </div>
      )}

      {isDeadlinePassed() ? (
        <p className="mt-12 text-center text-[#a1a1a6]">
          The deadline has passed. Head to the leaderboard to follow the competition.
        </p>
      ) : (
        <PickBoard teams={(teams ?? []) as Team[]} />
      )}
    </div>
  )
}
