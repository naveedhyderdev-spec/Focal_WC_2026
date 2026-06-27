'use client'

import { Fragment, useMemo, useState } from 'react'
import Flag from '@/components/Flag'
import { SLOT_LABEL, SLOT_MULTIPLIER, KNOCKOUT_POINTS, LUCKY_QF_BONUS, LUCKY_JACKPOT, type Slot } from '@/lib/scoring'

interface PickJson {
  slot: Slot
  tier: 'A' | 'B' | 'C'
  name: string
  code: string
  flag: string
  stage_reached: string
  alive: boolean
  is_champion: boolean
  group_points: number
  goals_for: number
  won: number
  draw: number
  lost: number
  group_letter: string
  group_position: number | null
}

export interface LeaderboardRow {
  user_id: string
  full_name: string
  office_location: string
  total_points: number
  total_goals: number
  giant_killer_points: number
  current_rank: number | null
  has_alive_pick: boolean
  picks: PickJson[]
}

const STAGE_LABEL: Record<string, string> = {
  GROUP_STAGE: 'Group stage', LAST_32: 'Round of 32', LAST_16: 'Round of 16',
  QUARTER_FINALS: 'Quarter-final', SEMI_FINALS: 'Semi-final', FINAL: 'Final',
}

export default function LeaderboardTable({
  rows, currentUserId, liveCodes = [],
}: {
  rows: LeaderboardRow[]
  currentUserId: string | null
  liveCodes?: string[]
}) {
  const liveSet = new Set(liveCodes)
  const offices = useMemo(
    () => ['All', ...[...new Set(rows.map(r => r.office_location).filter(Boolean))].sort()],
    [rows],
  )
  const [office, setOffice] = useState('All')
  const [open, setOpen] = useState<string | null>(null)
  const filtered = office === 'All' ? rows : rows.filter(r => r.office_location === office)

  if (rows.length === 0)
    return <p className="mt-12 text-center text-[#a1a1a6]">No picks submitted yet — be the first.</p>

  return (
    <div className="mt-10">
      <div className="mb-5 flex flex-wrap justify-center gap-2">
        {offices.map(o => (
          <button key={o} onClick={() => setOffice(o)}
            className={`rounded px-4 py-1.5 text-sm transition ${office === o ? 'bg-[#f5f5f7] font-medium text-black' : 'border border-[#2a2a2d] text-[#d2d2d7] hover:border-[#3a3a3d] hover:text-[#f5f5f7]'}`}>
            {o}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#2a2a2d]">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-[#161618] text-left text-xs uppercase tracking-wider text-[#a1a1a6]">
            <tr>
              <th className="px-3 py-3 font-medium text-[#6e6e73]">S.No</th>
              <th className="px-4 py-3 font-medium">Rank</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Office</th>
              <th className="px-4 py-3 font-medium">Squad</th>
              <th className="px-4 py-3 text-right font-medium">Goals</th>
              <th className="px-4 py-3 text-right font-medium">Score</th>
              <th className="w-10 px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const isOpen = open === r.user_id
              return (
                <Fragment key={r.user_id}>
                  <tr
                    onClick={() => setOpen(isOpen ? null : r.user_id)}
                    className={`cursor-pointer border-t border-[#2a2a2d]/80 transition hover:bg-[#161618]/60
                      ${r.user_id === currentUserId ? 'bg-[#161618]' : i % 2 ? 'bg-[#0d0d0e]' : ''}`}
                  >
                    <td className="px-3 py-3 text-[#6e6e73]">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-[#d2d2d7]">{r.current_rank ?? '—'}</td>
                    <td className="px-4 py-3 text-[#f5f5f7]">
                      {r.full_name}
                      {r.user_id === currentUserId && <span className="ml-1.5 text-xs text-[#a1a1a6]">(you)</span>}
                      {r.picks.some(p => liveSet.has(p.code)) ? (
                        <span className="ml-2 animate-pulse rounded border border-[#E8B23A]/70 bg-[#E8B23A]/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[#E8B23A]">● LIVE</span>
                      ) : r.has_alive_pick && (
                        <span className="ml-2 rounded border border-[#3a3a3d] px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-[#d2d2d7]">ALIVE</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#a1a1a6]">{r.office_location}</td>
                    <td className="px-4 py-3">
                      <span className="flex gap-1.5 text-base">
                        {r.picks.map(p => (
                          <span key={p.slot} title={`${p.name} (${SLOT_LABEL[p.slot]})${liveSet.has(p.code) ? ' — playing now' : ''}`}
                            className={`${p.alive ? '' : 'opacity-30 grayscale'} ${liveSet.has(p.code) ? 'animate-glowpulse rounded-sm' : ''}`}>
                            <Flag code={p.code} />
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-[#d2d2d7]">{r.total_goals}</td>
                    <td className="px-4 py-3 text-right font-heading text-base font-semibold text-[#E8B23A]">{r.total_points}</td>
                    <td className="px-2 py-3 text-center text-[#86868b]">
                      <span className={`inline-block transition-transform ${isOpen ? 'rotate-180' : ''}`}>⌄</span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-t border-[#2a2a2d]/50 bg-[#101011]">
                      <td colSpan={8} className="px-4 py-3">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {r.picks.map(p => {
                            const kn = p.is_champion ? KNOCKOUT_POINTS.WINNER : (KNOCKOUT_POINTS[p.stage_reached] ?? 0)
                            const mult = SLOT_MULTIPLIER[p.slot]
                            const base = (p.group_points + kn) * mult
                            const bonus = p.slot === 'lucky'
                              ? ((p.is_champion ? LUCKY_QF_BONUS + LUCKY_JACKPOT : kn >= KNOCKOUT_POINTS.QUARTER_FINALS ? LUCKY_QF_BONUS : 0))
                              : 0
                            const total = base + bonus
                            return (
                            <div key={p.slot}
                              className={`rounded border px-3 py-2.5 ${p.alive ? 'border-[#3a3a3d] bg-[#161618]/60' : 'border-[#2a2a2d] bg-transparent opacity-50'}`}>
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-sm text-[#f5f5f7]">
                                  <Flag code={p.code} /> {p.name}
                                </span>
                                <span className="text-[10px] uppercase tracking-wider text-[#a1a1a6]">
                                  {SLOT_LABEL[p.slot]} ×{mult}
                                </span>
                              </div>
                              <div className="mt-1.5 text-xs text-[#a1a1a6]">
                                {p.is_champion ? 'Champion' : STAGE_LABEL[p.stage_reached] ?? p.stage_reached}
                                {!p.alive && ' · out'} · {p.group_points} grp pts · {p.goals_for} goals · {p.won}-{p.draw}-{p.lost}
                              </div>
                              {/* how this pick's points are calculated */}
                              <div className="mt-2 border-t border-[#2a2a2d] pt-2 text-xs text-[#d2d2d7]">
                                ({p.group_points} grp {kn ? `+ ${kn} ${p.is_champion ? 'champion' : STAGE_LABEL[p.stage_reached] ?? ''}` : '+ 0 knockout'}) × {mult}
                                {bonus ? ` + ${bonus} bonus` : ''} ={' '}
                                <span className="font-heading font-semibold text-[#E8B23A]">{total} pts</span>
                              </div>
                            </div>
                          )})}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-center text-xs text-[#86868b]">Click a row to see pick details</p>
    </div>
  )
}
