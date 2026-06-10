'use client'

import { useMemo, useState } from 'react'
import Flag from '@/components/Flag'
import {
  GROUP_WIN, GROUP_DRAW, KNOCKOUT_POINTS, SLOT_MULTIPLIER, LUCKY_QF_BONUS, LUCKY_JACKPOT,
  PRIZE_TEXT, type Tier,
} from '@/lib/scoring'

export interface Team {
  id: number
  name: string
  code: string
  flag: string
  group_letter: string
  tier: Tier
}

const SECTIONS: { tier: Tier; title: string; sub: string }[] = [
  { tier: 'A', title: 'Your Favourite', sub: `Tier A · points ×${SLOT_MULTIPLIER.A}` },
  { tier: 'B', title: 'Your Contender', sub: `Tier B · points ×${SLOT_MULTIPLIER.B}` },
  { tier: 'C', title: 'Your Outsider', sub: `Tier C · points ×${SLOT_MULTIPLIER.C}` },
]

// Selection is client-side UI state only. The submit is a plain HTML form
// POST to /api/picks with hidden inputs — never a fetch() (v1 lesson).
export default function PickBoard({ teams }: { teams: Team[] }) {
  const [chosen, setChosen] = useState<Partial<Record<Tier, number>>>({})
  const [confirming, setConfirming] = useState(false)

  const byTier = useMemo(() => {
    const m: Record<Tier, Team[]> = { A: [], B: [], C: [] }
    for (const t of teams) m[t.tier]?.push(t)
    for (const k of Object.keys(m) as Tier[]) m[k].sort((a, b) => a.name.localeCompare(b.name))
    return m
  }, [teams])

  const byId = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams])
  const complete = chosen.A !== undefined && chosen.B !== undefined && chosen.C !== undefined

  function select(tier: Tier, id: number) {
    setChosen(c => ({ ...c, [tier]: c[tier] === id ? undefined : id }))
  }

  return (
    <div className="mt-10 space-y-8 pb-28">
      <p className="mx-auto max-w-2xl text-center text-sm leading-relaxed text-[#a1a1a6]">
        Pick one team from each tier. The lower the tier, the bigger the multiplier — outsiders
        are worth the most. Then a Lucky Country is spun for you at random from Tiers B and C.
      </p>

      {SECTIONS.map(({ tier, title, sub }) => (
        <section key={tier}>
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <h2 className="text-lg font-medium text-white">{title}</h2>
            <span className={`inline-flex items-center rounded-md px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${
              tier === 'A' ? 'border border-[#3a3a3d] bg-[#161618] text-white'
              : tier === 'B' ? 'bg-[#f5f5f7] text-black'
              : 'bg-[#3a3a3d] text-white'}`}>
              {sub}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {byTier[tier].map(t => {
              const selected = chosen[tier] === t.id
              return (
                <button
                  key={t.id} type="button" onClick={() => select(tier, t.id)}
                  className={`flex items-center justify-between rounded border px-3 py-2.5 text-left transition
                    ${selected
                      ? 'border-white bg-[#1d1d1f] text-white'
                      : 'border-[#2a2a2d] bg-[#161618] text-[#d2d2d7] hover:border-[#3a3a3d]'}`}
                >
                  <span className="flex items-center gap-2 text-sm">
                    <Flag code={t.code} /> {t.name}
                  </span>
                  <span className="text-[10px] text-[#86868b]">Group {t.group_letter}</span>
                </button>
              )
            })}
          </div>
        </section>
      ))}

      {/* Floating "Your Squad" panel */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#2a2a2d] bg-black/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="mr-1 text-xs uppercase tracking-wider text-[#a1a1a6]">Your squad</span>
            {SECTIONS.map(({ tier }) => {
              const t = chosen[tier] !== undefined ? byId.get(chosen[tier]!) : null
              return (
                <span key={tier} className={`rounded border px-3 py-1 text-sm ${t ? 'border-[#3a3a3d] bg-[#161618] text-[#f5f5f7]' : 'border-dashed border-[#2a2a2d] text-[#86868b]'}`}>
                  {t ? <span className="flex items-center gap-2"><Flag code={t.code} size="sm" /> {t.name}</span> : `Tier ${tier} —`}
                </span>
              )
            })}
            <span className="rounded border border-dashed border-[#2a2a2d] px-3 py-1 text-sm text-[#86868b]">
              Lucky — spun on submit
            </span>
          </div>
          <button
            type="button" disabled={!complete} onClick={() => setConfirming(true)}
            className={`rounded px-6 py-2.5 font-medium transition disabled:cursor-not-allowed disabled:opacity-30
              ${complete
                ? 'animate-glowpulse bg-[#E8B23A] text-black hover:bg-[#f0c155]'
                : 'bg-[#f5f5f7] text-black hover:bg-white'}`}
          >
            Review squad
          </button>
        </div>
      </div>

      {/* Confirm modal */}
      {confirming && complete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-[#3a3a3d] bg-[#161618] p-6">
            <h2 className="text-lg font-semibold text-white">Confirm your squad</h2>
            <div className="mt-4 space-y-2">
              {SECTIONS.map(({ tier, title }) => {
                const t = byId.get(chosen[tier]!)!
                return (
                  <div key={tier} className="flex items-center justify-between rounded bg-[#161618] px-4 py-2.5">
                    <span className="flex items-center gap-2.5 text-sm"><Flag code={t.code} /> {t.name}</span>
                    <span className="text-xs text-[#a1a1a6]">{title} · ×{SLOT_MULTIPLIER[tier]}</span>
                  </div>
                )
              })}
              <div className="flex items-center justify-between rounded border border-dashed border-[#3a3a3d] bg-[#161618]/50 px-4 py-2.5">
                <span className="text-sm text-[#d2d2d7]">Lucky Country</span>
                <span className="text-xs text-[#a1a1a6]">random from Tiers B + C · ×{SLOT_MULTIPLIER.lucky}</span>
              </div>
            </div>

            <div className="mt-5 rounded border border-[#2a2a2d] bg-[#0a0a0a] p-4 text-sm leading-relaxed text-[#d2d2d7]">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#d2d2d7]">How scoring works</h3>
              <p>Each team earns group points (win {GROUP_WIN}, draw {GROUP_DRAW}) plus knockout points for the furthest round it reaches: R32 {KNOCKOUT_POINTS.LAST_32}, R16 {KNOCKOUT_POINTS.LAST_16}, QF {KNOCKOUT_POINTS.QUARTER_FINALS}, SF {KNOCKOUT_POINTS.SEMI_FINALS}, Final {KNOCKOUT_POINTS.FINAL}, Winner {KNOCKOUT_POINTS.WINNER}.</p>
              <p className="mt-2">That sum is multiplied by the slot: Favourite ×{SLOT_MULTIPLIER.A}, Contender ×{SLOT_MULTIPLIER.B}, Outsider ×{SLOT_MULTIPLIER.C}, Lucky ×{SLOT_MULTIPLIER.lucky}. Your Lucky Country also gets +{LUCKY_QF_BONUS} if it reaches the Quarter-finals and +{LUCKY_JACKPOT} if it wins the Cup.</p>
              <p className="mt-2">{PRIZE_TEXT}</p>
              <p className="mt-3 font-medium text-[#f5f5f7]">Submitting spins your Lucky Country and locks all 4 picks for the whole tournament — one spin, no re-rolls.</p>
            </div>

            <form action="/api/picks" method="POST" className="mt-5">
              <input type="hidden" name="pickA" value={chosen.A} />
              <input type="hidden" name="pickB" value={chosen.B} />
              <input type="hidden" name="pickC" value={chosen.C} />
              <button className="w-full rounded bg-[#f5f5f7] py-3 font-semibold text-black transition hover:bg-white">
                <span className="mr-2 inline-block align-middle">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/ball.png" alt="" style={{clipPath: "circle(47%)"}} className="animate-ballspin inline h-5 w-5" />
                </span>
                Spin my Lucky Country &amp; lock my squad
              </button>
            </form>
            <button
              type="button" onClick={() => setConfirming(false)}
              className="mt-2 w-full rounded border border-[#3a3a3d] py-2.5 text-[#d2d2d7] transition hover:bg-[#161618]"
            >
              Go back and change
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
