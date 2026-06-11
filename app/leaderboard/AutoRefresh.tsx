'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Re-fetches the leaderboard data every 2 minutes so live goals and match
// states appear without a manual reload. Server data only — no flicker.
export default function AutoRefresh() {
  const router = useRouter()
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 120_000)
    return () => clearInterval(t)
  }, [router])
  return null
}
