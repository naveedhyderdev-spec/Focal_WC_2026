'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SLOT_LABEL, SLOT_MULTIPLIER, type Slot } from '@/lib/scoring'

interface TeamLite { name: string; code: string; flag: string }
interface SquadPick extends TeamLite { slot: Slot }

const SLOT_ORDER: Slot[] = ['A', 'B', 'C', 'lucky']

// Slot-machine style reveal: cycles through the Tier B+C pool, slows down,
// and lands on the server-decided lucky team. Purely cosmetic.
export default function LuckyWheel({ squad, pool }: { squad: SquadPick[]; pool: TeamLite[] }) {
  const lucky = squad.find(p => p.slot === 'lucky')
  const [display, setDisplay] = useState<TeamLite | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!lucky || pool.length === 0) { setDone(true); return }
    let i = 0
    let delay = 60
    let timer: ReturnType<typeof setTimeout>
    const spin = () => {
      setDisplay(pool[i % pool.length])
      i++
      delay *= 1.07                       // decelerate
      if (delay < 450) timer = setTimeout(spin, delay)
      else {
        setDisplay(lucky)
        setTimeout(() => setDone(true), 600)
      }
    }
    timer = setTimeout(spin, delay)
    return () => clearTimeout(timer)
  }, [lucky, pool])

  const sorted = [...squad].sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot))

  return (
    <div className="mx-auto max-w-lg text-center">
      <h1 className="text-3xl font-normal tracking-tight text-white">Your Lucky Country</h1>
      <p className="mt-2 text-sm text-[#9AA7CC]">Spun at random from Tiers B and C</p>

      <div className={`mx-auto mt-10 flex h-44 w-44 flex-col items-center justify-center rounded-full border transition-all duration-500
        ${done ? 'scale-110 border-[#1D4EC6] bg-[#0A2050] shadow-[0_0_50px_rgba(228,228,231,0.18)]' : 'border-[#3A4A6B] bg-[#0A2050]'}`}>
        <span className="text-6xl">{display?.flag ?? '·'}</span>
        <span className="mt-1 px-2 text-sm text-[#C5CFE8]">{display?.name ?? 'Spinning…'}</span>
      </div>

      {done && (
        <div className="mt-12">
          <h2 className="text-lg font-medium text-white">Squad complete — all 4 picks locked</h2>
          <div className="mt-5 space-y-2 text-left">
            {sorted.map(p => (
              <div key={p.slot}
                className={`flex items-center justify-between rounded px-4 py-3 ${p.slot === 'lucky' ? 'border border-dashed border-[#3A4A6B] bg-[#0A2050]/50' : 'bg-[#0A2050]'}`}>
                <span className="flex items-center gap-2.5"><span className="text-xl">{p.flag}</span> <span className="text-[#E7ECFA]">{p.name}</span></span>
                <span className="text-xs text-[#9AA7CC]">{SLOT_LABEL[p.slot]} · ×{SLOT_MULTIPLIER[p.slot]}</span>
              </div>
            ))}
          </div>
          <Link href="/leaderboard"
            className="mt-10 inline-block rounded bg-[#1D4EC6] px-6 py-3 font-medium text-white transition hover:bg-[#173E9E]">
            Go to the leaderboard
          </Link>
        </div>
      )}
    </div>
  )
}
