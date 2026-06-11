'use client'

import Flag from '@/components/Flag'

export interface MatchLite {
  fd_match_id: number
  status: string
  utc_date: string | null
  home_team_code: string | null
  away_team_code: string | null
  home_score: number | null
  away_score: number | null
}

// Today's fixtures above the leaderboard: LIVE with score, upcoming with
// kickoff in the viewer's local time, finished with FT. Pure display.
export default function MatchStrip({
  matches, names,
}: {
  matches: MatchLite[]
  names: Record<string, string>
}) {
  if (matches.length === 0) return null

  const kickoff = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : ''

  return (
    <div className="mt-8">
      <h2 className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.25em] text-[#86868b]">
        Today&apos;s matches
      </h2>
      <div className="flex flex-wrap justify-center gap-2">
        {matches.map(m => {
          const live = m.status === 'IN_PLAY' || m.status === 'PAUSED'
          const done = m.status === 'FINISHED'
          return (
            <div key={m.fd_match_id}
              className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm
                ${live ? 'border-[#E8B23A]/60 bg-[#E8B23A]/10' : 'border-[#2a2a2d] bg-[#161618]'}`}>
              <span className="flex items-center gap-1.5 text-[#f5f5f7]">
                {m.home_team_code && <Flag code={m.home_team_code} size="sm" />}
                {m.home_team_code ? names[m.home_team_code] ?? m.home_team_code : 'TBD'}
              </span>
              <span className="font-heading font-semibold tabular-nums text-white">
                {live || done ? `${m.home_score ?? 0}–${m.away_score ?? 0}` : 'v'}
              </span>
              <span className="flex items-center gap-1.5 text-[#f5f5f7]">
                {m.away_team_code ? names[m.away_team_code] ?? m.away_team_code : 'TBD'}
                {m.away_team_code && <Flag code={m.away_team_code} size="sm" />}
              </span>
              <span className={`ml-1 text-[10px] font-bold uppercase tracking-wider
                ${live ? 'animate-pulse text-[#E8B23A]' : done ? 'text-[#86868b]' : 'text-[#a1a1a6]'}`}>
                {live ? (m.status === 'PAUSED' ? 'HT' : '● LIVE') : done ? 'FT' : kickoff(m.utc_date)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
