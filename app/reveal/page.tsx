import { redirect } from 'next/navigation'
import { createServerComponentClient } from '@/lib/supabase/server'
import LuckyWheel from './LuckyWheel'
import type { Slot } from '@/lib/scoring'

// The lucky team was ALREADY decided server-side in /api/picks.
// This page is purely a reveal animation — it cannot change the outcome.
export default async function RevealPage() {
  const supabase = await createServerComponentClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: picks } = await supabase
    .from('picks')
    .select('slot, teams(name, code, flag)')
    .eq('user_id', user.id)
  if (!picks || picks.length === 0) redirect('/picks')

  // wheel cycles through the lucky pool (Tiers B+C) for realism
  const { data: poolTeams } = await supabase
    .from('teams').select('name, code, flag').in('tier', ['B', 'C']).order('name')

  const squad = picks.map(p => {
    const t = Array.isArray(p.teams) ? p.teams[0] : p.teams
    return { slot: p.slot as Slot, name: t?.name ?? '', code: t?.code ?? '', flag: t?.flag ?? '' }
  })

  return <LuckyWheel squad={squad} pool={poolTeams ?? []} />
}
