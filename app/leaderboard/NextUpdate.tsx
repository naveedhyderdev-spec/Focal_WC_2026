'use client'

import { useEffect, useState } from 'react'

// Scores refresh every hour at :05 (GitHub Actions schedule). This banner
// is purely informational — it counts down to the next run.
export default function NextUpdate() {
  const [left, setLeft] = useState<number | null>(null)

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const next = new Date(now)
      next.setMinutes(5, 0, 0)
      if (next <= now) next.setHours(next.getHours() + 1)
      setLeft(next.getTime() - now.getTime())
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  if (left === null) return null // render after mount to avoid hydration mismatch

  const m = Math.floor(left / 60_000)
  const s = Math.floor((left % 60_000) / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <p className="mt-2 text-center text-xs text-[#86868b]">
      Scores update every hour · next update in{' '}
      <span className="font-heading font-semibold tabular-nums text-[#d2d2d7]">{pad(m)}m {pad(s)}s</span>
    </p>
  )
}
