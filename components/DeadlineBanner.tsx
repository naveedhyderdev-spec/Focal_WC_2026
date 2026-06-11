'use client'

import { useEffect, useState } from 'react'

// Shared deadline banner for login / signup / leaderboard.
// Counts down live and shows the cutoff in Dubai time AND the viewer's
// local time (browser-detected). Disappears entirely once the deadline
// passes — display only; the server enforces the real cutoff.
export default function DeadlineBanner({ deadlineIso }: { deadlineIso: string }) {
  const [left, setLeft] = useState<number | null>(null)

  useEffect(() => {
    const deadline = new Date(deadlineIso).getTime()
    const tick = () => setLeft(Math.max(0, deadline - Date.now()))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [deadlineIso])

  // render only after mount (avoids hydration mismatch), hide after deadline
  if (left === null || left === 0) return null

  const deadline = new Date(deadlineIso)
  const fmt = (tz?: string) =>
    new Intl.DateTimeFormat(undefined, {
      hour: 'numeric', minute: '2-digit', hour12: true, ...(tz ? { timeZone: tz } : {}),
    }).format(deadline)
  const dubai = fmt('Asia/Dubai')
  const local = fmt()
  const sameAsDubai = dubai === local

  const h = Math.floor(left / 3_600_000)
  const m = Math.floor((left % 3_600_000) / 60_000)
  const s = Math.floor((left % 60_000) / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const urgent = left < 3_600_000

  return (
    <div className={`mx-auto mt-6 max-w-md rounded-lg border px-4 py-3 text-center ${urgent ? 'border-[#E8B23A]/60 bg-[#E8B23A]/10' : 'border-[#2a2a2d] bg-[#161618]'}`}>
      <p className={`font-heading text-base font-semibold tabular-nums ${urgent ? 'animate-pulse text-[#E8B23A]' : 'text-white'}`}>
        Squad picks close in {h > 0 ? `${h}h ` : ''}{pad(m)}m {pad(s)}s
      </p>
      <p className="mt-1 text-xs text-[#a1a1a6]">
        Tonight at {dubai} Dubai time{!sameAsDubai && <> · that&apos;s {local} your local time</>}
      </p>
    </div>
  )
}
