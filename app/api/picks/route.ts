import { NextResponse, type NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDeadlinePassed } from '@/lib/config'
import { randomInt } from 'node:crypto'

// Form POST with hidden inputs pickA/pickB/pickC (team ids, one per tier).
// Server validates each team is in its tier, spins the Lucky Country from
// Tiers B+C (never a Favourite, never an already-picked team), and inserts
// all 4 slots atomically. One spin only, ever.
export async function POST(request: NextRequest) {
  const origin = new URL(request.url).origin
  const { supabase, applyCookies } = createRouteClient(request)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    return applyCookies(NextResponse.redirect(`${origin}/login?error=session`, 303))

  if (isDeadlinePassed())
    return applyCookies(NextResponse.redirect(`${origin}/picks?error=deadline`, 303))

  const form = await request.formData()
  const chosen: Record<'A' | 'B' | 'C', number> = {
    A: Number(form.get('pickA')),
    B: Number(form.get('pickB')),
    C: Number(form.get('pickC')),
  }
  const ids = Object.values(chosen)
  if (ids.some(n => !Number.isInteger(n) || n <= 0) || new Set(ids).size !== 3)
    return applyCookies(NextResponse.redirect(`${origin}/picks?error=invalid`, 303))

  const admin = createAdminClient()

  // One spin only, ever
  const { count } = await admin
    .from('picks').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
  if ((count ?? 0) > 0)
    return applyCookies(NextResponse.redirect(`${origin}/picks?error=locked`, 303))

  // Each chosen team must exist AND belong to the slot's tier
  const { data: teams, error: teamsError } = await admin.from('teams').select('id, tier')
  if (teamsError || !teams)
    return applyCookies(NextResponse.redirect(`${origin}/picks?error=server`, 303))
  const tierById = new Map(teams.map(t => [t.id, t.tier as string]))
  for (const [slot, id] of Object.entries(chosen))
    if (tierById.get(id) !== slot)
      return applyCookies(NextResponse.redirect(`${origin}/picks?error=invalid`, 303))

  // Lucky spin: Tiers B+C, excluding the 3 chosen — server-side, no re-rolls
  const pool = teams.filter(t => (t.tier === 'B' || t.tier === 'C') && !ids.includes(t.id))
  const lucky = pool[randomInt(pool.length)]

  const rows = [
    { user_id: user.id, team_id: chosen.A, slot: 'A' },
    { user_id: user.id, team_id: chosen.B, slot: 'B' },
    { user_id: user.id, team_id: chosen.C, slot: 'C' },
    { user_id: user.id, team_id: lucky.id, slot: 'lucky' },
  ]
  const { error: insertError } = await admin.from('picks').insert(rows)
  if (insertError) {
    // unique(user_id, slot) makes a double-submit race fail here — treat as locked
    const code = insertError.code === '23505' ? 'locked' : 'server'
    return applyCookies(NextResponse.redirect(`${origin}/picks?error=${code}`, 303))
  }

  return applyCookies(NextResponse.redirect(`${origin}/reveal`, 303))
}
