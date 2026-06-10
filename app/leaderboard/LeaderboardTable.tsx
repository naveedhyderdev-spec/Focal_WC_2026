'use client'

import { Fragment, useMemo, useState } from 'react'
import Flag from '@/components/Flag'
import { PRIZES, SLOT_LABEL, SLOT_MULTIPLIER, type Slot } from '@/lib/scoring'

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

// Live prize holders with the one-prize-per-person rule: assign from the
// largest prize down, skipping anyone already awarded. Snapshot prizes
// (Group Stage Leader, Biggest Climber) activate after the group stage.
function livePrizeHolders(rows: LeaderboardRow[]): { label: string; amount: number; name: string }[] {
  if (rows.length === 0) return []
  // Before any match is played everyone is on 0 — naming "winners" would be
  // meaningless, so hide the prize strip until real points exist.
  if (!rows.some(r => r.total_points > 0)) return []
  const candidates: Record<string, LeaderboardRow[]> = {
    overall: [...rows].sort((a, b) => b.total_points - a.total_points),
    giant_killer: [...rows].sort((a, b) => b.giant_killer_points - a.giant_killer_points),
    wooden_spoon: [...rows].sort((a, b) => a.total_points - b.total_points),
  }
  const awarded = new Set<string>()
  const result: { label: string; amount: number; name: string }[] = []
  for (const prize of [...PRIZES].sort((a, b) => b.amount - a.amount)) {
    const pool = candidates[prize.key]
    if (!pool) continue // snapshot-based prize, not live yet
    const winner = pool.find(r => !awarded.has(r.user_id))
    if (!winner) continue
    awarded.add(winner.user_id)
    result.push({ label: prize.label, amount: prize.amount, name: winner.full_name })
  }
  return result
}

export default function LeaderboardTable({
  rows, currentUserId,
}: {
  rows: LeaderboardRow[]
  currentUserId: string | null
}) {
  const offices = useMemo(
    () => ['All', ...[...new Set(rows.map(r => r.office_location).filter(Boolean))].sort()],
    [rows],
  )
  const [office, setOffice] = useState('All')
  const [open, setOpen] = useState<string | null>(null)
  const filtered = office === 'All' ? rows : rows.filter(r => r.office_location === office)
  const prizes = useMemo(() => livePrizeHolders(rows), [rows])

  if (rows.length === 0)
    return <p className="mt-12 text-center text-[#a1a1a6]">No picks submitted yet — be the first.</p>

  return (
    <div className="mt-10">
      {prizes.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {prizes.map(p => (
            <div key={p.label} className="rounded border border-[#2a2a2d] bg-[#161618] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#a1a1a6]">
                {p.label} · <span className="font-semibold text-[#E8B23A]">${p.amount}</span>
              </div>
              <div className="mt-1 text-sm text-[#f5f5f7]">{p.name}</div>
            </div>
          ))}
        </div>
      )}

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
              <th className="px-4 py-3 font-medium">#</th>
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
                    <td className="px-4 py-3 font-semibold text-[#d2d2d7]">{r.current_rank ?? i + 1}</td>
                    <td className="px-4 py-3 text-[#f5f5f7]">
                      {r.full_name}
                      {r.user_id === currentUserId && <span className="ml-1.5 text-xs text-[#a1a1a6]">(you)</span>}
                      {r.has_alive_pick && (
                        <span className="ml-2 rounded border border-[#3a3a3d] px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-[#d2d2d7]">ALIVE</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#a1a1a6]">{r.office_location}</td>
                    <td className="px-4 py-3">
                      <span className="flex gap-1.5 text-base">
                        {r.picks.map(p => (
                          <span key={p.slot} title={`${p.name} (${SLOT_LABEL[p.slot]})`} className={p.alive ? '' : 'opacity-30 grayscale'}><Flag code={p.code} /></span>
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
                      <td colSpan={7} className="px-4 py-3">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {r.picks.map(p => (
                            <div key={p.slot}
                              className={`rounded border px-3 py-2.5 ${p.alive ? 'border-[#3a3a3d] bg-[#161618]/60' : 'border-[#2a2a2d] bg-transparent opacity-50'}`}>
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-sm text-[#f5f5f7]">
                                  <Flag code={p.code} /> {p.name}
                                </span>
                                <span className="text-[10px] uppercase tracking-wider text-[#a1a1a6]">
                                  {SLOT_LABEL[p.slot]} ×{SLOT_MULTIPLIER[p.slot]}
                                </span>
                              </div>
                              <div className="mt-1.5 text-xs text-[#a1a1a6]">
                                {p.is_champion ? 'Champion' : STAGE_LABEL[p.stage_reached] ?? p.stage_reached}
                                {!p.alive && ' · out'} · {p.group_points} grp pts · {p.goals_for} goals · {p.won}-{p.draw}-{p.lost}
                              </div>
                            </div>
                          ))}
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
