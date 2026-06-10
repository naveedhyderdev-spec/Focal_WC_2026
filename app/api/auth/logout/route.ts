import { NextResponse, type NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'

export async function POST(request: NextRequest) {
  const origin = new URL(request.url).origin
  const { supabase, applyCookies } = createRouteClient(request)
  await supabase.auth.signOut()

  const response = applyCookies(NextResponse.redirect(`${origin}/login`, 303))
  // Force-clear any sb-* cookies so a stale/deleted-user session can always be cleared
  for (const c of request.cookies.getAll())
    if (c.name.startsWith('sb-')) response.cookies.set(c.name, '', { maxAge: 0, path: '/' })
  return response
}
