'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Flag from '@/components/Flag'
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
      <p className="mt-2 text-sm text-[#a1a1a6]">Spun at random from Tiers B and C</p>

      <div className="relative mx-auto mt-10 h-52 w-52">
        {/* the match ball spins like it's rolling in 3D while the draw runs */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ball.png" alt="" style={{clipPath: "circle(47%)"}}
          className={`absolute inset-0 h-full w-full transition-opacity duration-500
            ${done ? 'opacity-0' : 'animate-ballspin-fast opacity-100'}`} />
        {done && display && (
          <div className="animate-pop absolute inset-0 flex flex-col items-center justify-center rounded-full border border-[#E8B23A]/70 bg-[#161618] shadow-[0_0_60px_rgba(232,178,58,0.35)]">
            <Flag code={display.code} size="lg" />
            <span className="mt-2 px-2 font-heading text-base font-semibold text-white">{display.name}</span>
          </div>
        )}
        {!done && (
          <span className="absolute -bottom-9 left-0 right-0 text-sm text-[#d2d2d7]">
            {display?.name ?? 'Spinning…'}
          </span>
        )}
      </div>

      {done && (
        <div className="animate-risein-1 mt-14">
          <h2 className="text-lg font-medium text-white">Squad complete — all 4 picks locked</h2>
          <div className="mt-5 space-y-2 text-left">
            {sorted.map(p => (
              <div key={p.slot}
                className={`flex items-center justify-between rounded px-4 py-3 ${p.slot === 'lucky' ? 'border border-dashed border-[#3a3a3d] bg-[#161618]/50' : 'bg-[#161618]'}`}>
                <span className="flex items-center gap-2.5"><Flag code={p.code} /> <span className="text-[#f5f5f7]">{p.name}</span></span>
                <span className="text-xs text-[#a1a1a6]">{SLOT_LABEL[p.slot]} · ×{SLOT_MULTIPLIER[p.slot]}</span>
              </div>
            ))}
          </div>
          <Link href="/leaderboard"
            className="mt-10 inline-block rounded bg-[#f5f5f7] px-6 py-3 font-medium text-black transition hover:bg-white">
            Go to the leaderboard
          </Link>
        </div>
      )}
    </div>
  )
}
