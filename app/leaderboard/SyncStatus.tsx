'use client'

import { useEffect, useState } from 'react'

// Real "Last updated" status, driven by the actual sync (not a clock guess).
// - lastChangeAt: when the data last ACTUALLY changed (+ what changed)
// - lastRunAt: when the sync last ran at all (proves it's alive)
// - lastRunChanged: did the most recent run change anything (if not, say so)
export default function SyncStatus({
  lastRunAt, lastChangeAt, lastRunChanged, summary,
}: {
  lastRunAt: string | null
  lastChangeAt: string | null
  lastRunChanged: boolean
  summary: string[]
}) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 15_000)
    return () => clearInterval(t)
  }, [])

  if (!lastRunAt) {
    return <p className="mt-2 text-center text-xs text-[#86868b]">Scores update automatically every 5 minutes.</p>
  }

  const ago = (iso: string | null) => {
    if (!iso) return ''
    const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
    if (s < 60) return 'just now'
    const m = Math.floor(s / 60)
    if (m < 60) return `${m} min ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h} hr${h > 1 ? 's' : ''} ago`
    return `${Math.floor(h / 24)} day${h >= 48 ? 's' : ''} ago`
  }
  const clock = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : ''

  return (
    <div className="mt-2 text-center text-xs text-[#86868b]">
      {lastChangeAt ? (
        <p>
          <span className="text-[#d2d2d7]">Last updated:</span> {clock(lastChangeAt)} ({ago(lastChangeAt)})
          {summary.length > 0 && (
            <span className="text-[#86868b]"> · {summary.slice(0, 2).join(' · ')}{summary.length > 2 ? ` +${summary.length - 2} more` : ''}</span>
          )}
        </p>
      ) : (
        <p>No score changes yet — picks are in, waiting for results.</p>
      )}
      <p className="mt-0.5 text-[#6e6e73]">
        Checked for updates {ago(lastRunAt)}
        {!lastRunChanged && lastChangeAt ? ' · no new changes' : ''} · auto-checks every 5 min
      </p>
    </div>
  )
}
