import Link from 'next/link'
import Flag from '@/components/Flag'
import { SLOT_LABEL, SLOT_MULTIPLIER, type Slot } from '@/lib/scoring'
import { CAPTAINS } from '@/lib/captains'
import type { Team } from './PickBoard'

const SLOT_ORDER: Slot[] = ['A', 'B', 'C', 'lucky']

export default function LockedPicks({
  picks, teams,
}: {
  picks: { slot: Slot; team_id: number }[]
  teams: Team[]
}) {
  const byId = new Map(teams.map(t => [t.id, t]))
  const sorted = [...picks].sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot))
  return (
    <div className="mx-auto max-w-lg text-center">
      <h1 className="text-3xl font-normal tracking-tight text-white">Your squad is locked in</h1>
      <p className="mt-2 text-sm text-[#9AA7CC]">No changes possible — good luck.</p>
      <div className="mt-8 space-y-2 text-left">
        {sorted.map(p => {
          const t = byId.get(p.team_id)
          return (
            <div key={p.slot}
              className={`flex items-center justify-between rounded px-4 py-3 ${p.slot === 'lucky' ? 'border border-dashed border-[#3A4A6B] bg-[#0A2050]/50' : 'bg-[#0A2050]'}`}>
              <span className="flex items-center gap-2.5">
                {t && <Flag code={t.code} />} <span className="text-[#E7ECFA]">{t?.name}</span>
              </span>
              <span className="text-xs text-[#9AA7CC]">{SLOT_LABEL[p.slot]} · ×{SLOT_MULTIPLIER[p.slot]}</span>
            </div>
          )
        })}
      </div>
      {/* Your captains */}
      <h2 className="mt-12 text-lg font-medium text-white">Your captains</h2>
      <p className="mt-1 text-sm text-[#9AA7CC]">The men leading your four countries</p>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {sorted.map(p => {
          const t = byId.get(p.team_id)
          const cap = t ? CAPTAINS[t.code] : undefined
          if (!t || !cap) return null
          return (
            <div key={p.slot} className="rounded-lg border border-[#1d3464] bg-[#0A2050] p-3 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cap.img} alt={cap.name} loading="lazy"
                className="mx-auto h-24 w-20 rounded object-cover object-top ring-1 ring-white/10" />
              <div className="mt-2.5 text-sm font-medium text-[#E7ECFA]">{cap.name}</div>
              <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-[#9AA7CC]">
                <Flag code={t.code} size="sm" /> {t.name}
              </div>
            </div>
          )
        })}
      </div>

      <Link href="/leaderboard"
        className="mt-10 inline-block rounded bg-[#1D4EC6] px-6 py-3 font-medium text-white transition hover:bg-[#173E9E]">
        View the leaderboard
      </Link>
    </div>
  )
}
