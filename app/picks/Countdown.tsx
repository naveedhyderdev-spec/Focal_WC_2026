'use client'

import { useEffect, useState } from 'react'

// Live countdown to the pick deadline. Display-only — the server enforces
// the real cutoff on every submission regardless of what this shows.
export default function Countdown({ deadlineIso }: { deadlineIso: string }) {
  const [left, setLeft] = useState<number | null>(null)

  useEffect(() => {
    const deadline = new Date(deadlineIso).getTime()
    const tick = () => setLeft(Math.max(0, deadline - Date.now()))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [deadlineIso])

  if (left === null) return null // avoid hydration mismatch — render after mount

  if (left === 0)
    return (
      <p className="mt-4 font-heading text-lg font-semibold text-[#E8B23A]">
        Picks are locked — the tournament has begun
      </p>
    )

  const h = Math.floor(left / 3_600_000)
  const m = Math.floor((left % 3_600_000) / 60_000)
  const s = Math.floor((left % 60_000) / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const urgent = left < 3_600_000

  return (
    <p className={`mt-4 font-heading text-lg font-semibold tabular-nums ${urgent ? 'animate-pulse text-[#E8B23A]' : 'text-white'}`}>
      Picks lock in {h > 0 ? `${h}h ` : ''}{pad(m)}m {pad(s)}s
    </p>
  )
}
