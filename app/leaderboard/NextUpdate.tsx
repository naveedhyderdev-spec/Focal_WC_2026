'use client'

import { useEffect, useState } from 'react'

// Scores refresh every 5 minutes (cron-job.org schedule). This banner
// is purely informational — it counts down to the next run.
export default function NextUpdate() {
  const [left, setLeft] = useState<number | null>(null)

  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      const next = Math.ceil(now / 300_000) * 300_000 // next 5-minute boundary
      setLeft(next - now)
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
      Scores update every 5 minutes · next update in{' '}
      <span className="font-heading font-semibold tabular-nums text-[#d2d2d7]">{pad(m)}m {pad(s)}s</span>
    </p>
  )
}
