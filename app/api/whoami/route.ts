import { NextResponse, type NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'

// Diagnostic: reports whether the server sees a session from cookies.
export async function GET(request: NextRequest) {
  const { supabase } = createRouteClient(request)
  const { data, error } = await supabase.auth.getUser()
  return NextResponse.json({
    authenticated: !!data.user,
    email: data.user?.email ?? null,
    cookiesSeen: request.cookies.getAll().map(c => c.name),
    error: error?.message ?? null,
  })
}
