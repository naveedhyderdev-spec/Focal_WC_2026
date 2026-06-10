import Link from 'next/link'
import {
  GROUP_WIN, GROUP_DRAW, KNOCKOUT_POINTS, SLOT_MULTIPLIER,
  LUCKY_QF_BONUS, LUCKY_JACKPOT,
} from '@/lib/scoring'
import { formatDeadline } from '@/lib/config'

function Card({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#1d3464] bg-[#0A2050] px-6 py-8 sm:px-10 sm:py-10">
      <div className="mb-6 flex items-center gap-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#3A4A6B] text-sm font-semibold text-[#C5CFE8]">
          {step}
        </span>
        <h2 className="text-xl font-medium text-white">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function PointsRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[#1d3464]/70 py-3 last:border-0">
      <span className="text-[#C5CFE8]">
        {label}
        {hint && <span className="ml-2 text-sm text-[#7585AE]">{hint}</span>}
      </span>
      <span className="text-lg font-semibold text-white">{value}</span>
    </div>
  )
}

export default function HowToPlayPage() {
  return (
    <div className="mx-auto max-w-2xl px-2 pb-16 pt-4">
      <h1 className="text-center text-4xl font-normal tracking-tight text-white">How to Play</h1>
      <p className="mt-4 text-center text-lg text-[#9AA7CC]">Four picks. One spin. Five prizes.</p>

      <div className="mt-14 space-y-12 text-base leading-8 text-[#C5CFE8]">

        <Card step="1" title="Build your squad">
          <p>
            Every team in the World Cup is sorted into three tiers:{' '}
            <span className="text-[#E7ECFA]">Favourites</span> (the big names expected to win),{' '}
            <span className="text-[#E7ECFA]">Contenders</span> (strong but not favourites), and{' '}
            <span className="text-[#E7ECFA]">Outsiders</span> (the long shots).
          </p>
          <p className="mt-6">You pick one team from each tier — that&apos;s 3 picks.</p>
          <p className="mt-6">
            Then the app spins a <span className="text-[#E7ECFA]">Lucky Country</span>{' '}
            for you: a random extra team you didn&apos;t pick. You can&apos;t choose it and you can&apos;t re-spin — that&apos;s the fun.
          </p>
          <p className="mt-6">
            Once you submit, your 4 teams are locked for the whole tournament.
          </p>
        </Card>

        <Card step="2" title="How you score points">
          <p>Your teams earn you points by doing well — in two ways:</p>

          <div className="mt-6 rounded-lg border border-[#1d3464] bg-[#011541] px-6 py-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#9AA7CC]">
              In the group stage
            </h3>
            <PointsRow label="Every match won" value={`${GROUP_WIN} pts`} />
            <PointsRow label="Every match drawn" value={`${GROUP_DRAW} pt`} />
          </div>

          <div className="mt-6 rounded-lg border border-[#1d3464] bg-[#011541] px-6 py-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#9AA7CC]">
              Then, the further they go…
            </h3>
            <PointsRow label="Reach the Round of 32" value={`${KNOCKOUT_POINTS.LAST_32} pts`} />
            <PointsRow label="Reach the Round of 16" value={`${KNOCKOUT_POINTS.LAST_16} pts`} />
            <PointsRow label="Reach the Quarter-final" value={`${KNOCKOUT_POINTS.QUARTER_FINALS} pts`} />
            <PointsRow label="Reach the Semi-final" value={`${KNOCKOUT_POINTS.SEMI_FINALS} pts`} />
            <PointsRow label="Reach the Final" value={`${KNOCKOUT_POINTS.FINAL} pts`} />
            <PointsRow label="Win the World Cup" value={`${KNOCKOUT_POINTS.WINNER} pts`} />
            <p className="mt-3 text-sm text-[#7585AE]">Only the furthest round counts — they don&apos;t stack.</p>
          </div>

          <div className="mt-6 rounded-lg border border-[#1d3464] bg-[#011541] px-6 py-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#9AA7CC]">
              Multiplied by who picked them
            </h3>
            <PointsRow label="Your Favourite" hint="safe pick" value={`× ${SLOT_MULTIPLIER.A}`} />
            <PointsRow label="Your Contender" hint="bolder" value={`× ${SLOT_MULTIPLIER.B}`} />
            <PointsRow label="Your Outsider" hint="boldest" value={`× ${SLOT_MULTIPLIER.C}`} />
            <PointsRow label="Your Lucky Country" value={`× ${SLOT_MULTIPLIER.lucky}`} />
          </div>

          <p className="mt-6">
            In short: <span className="text-[#E7ECFA]">underdogs pay more</span>. An Outsider reaching the
            Semi-final earns far more than a Favourite doing the same.
          </p>

          <div className="mt-6 rounded-lg border border-dashed border-[#3A4A6B] bg-[#0A2050]/40 px-6 py-5">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#9AA7CC]">Example</h3>
            <p className="text-[#C5CFE8]">
              Your Outsider wins 2 group games ({GROUP_WIN * 2} pts) and reaches the Quarter-final
              ({KNOCKOUT_POINTS.QUARTER_FINALS} pts). That&apos;s {GROUP_WIN * 2 + KNOCKOUT_POINTS.QUARTER_FINALS} × {SLOT_MULTIPLIER.C} ={' '}
              <span className="font-semibold text-white">{(GROUP_WIN * 2 + KNOCKOUT_POINTS.QUARTER_FINALS) * SLOT_MULTIPLIER.C} points</span> — from one team.
            </p>
          </div>

          <p className="mt-6">
            Bonus: your Lucky Country earns <span className="text-[#E7ECFA]">+{LUCKY_QF_BONUS} extra</span> if
            it reaches the Quarter-finals, and <span className="text-[#E7ECFA]">+{LUCKY_JACKPOT} more</span> if
            it wins the whole World Cup.
          </p>
        </Card>

        <Card step="3" title="Five prizes — $1,000 pot">
          <div className="rounded-lg border border-[#1d3464] bg-[#011541] px-6 py-5">
            <PointsRow label="Overall Champion" hint="most points at the end" value="1st" />
            <PointsRow label="Group Stage Leader" hint="top of the table on 27 June" value="—" />
            <PointsRow label="Giant Killer" hint="best Outsider + Lucky combined" value="—" />
            <PointsRow label="Biggest Climber" hint="most places gained after the groups" value="—" />
            <PointsRow label="Wooden Spoon" hint="dead last. Someone has to" value="—" />
          </div>
          <p className="mt-6">
            One prize per person — if you top two categories, you take the bigger one and the other
            passes to the next player. Five different winners share the pot.
          </p>
        </Card>

        <Card step="4" title="Deadline & ties">
          <p>
            Picks lock at <span className="text-[#E7ECFA]">{formatDeadline()}</span> — the moment the first
            ball is kicked. No edits after that.
          </p>
          <p className="mt-6">
            If two players finish level on points: whoever&apos;s Lucky Country went further wins; still
            level, whoever&apos;s Outsider went further; still level, the prize is shared.
          </p>
          <p className="mt-6">The leaderboard updates automatically every day.</p>
        </Card>
      </div>

      <div className="mt-14 text-center">
        <Link href="/picks" className="inline-block rounded-lg bg-[#1D4EC6] px-12 py-4 text-lg font-semibold text-white transition hover:bg-[#173E9E]">
          Build my squad
        </Link>
      </div>
    </div>
  )
}
