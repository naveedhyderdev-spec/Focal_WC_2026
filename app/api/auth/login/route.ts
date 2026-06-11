import { NextResponse, type NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { isAllowedEmail } from '@/lib/config'
import { derivedPassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const email = String(form.get('email') ?? '').trim()
  const origin = new URL(request.url).origin

  if (!isAllowedEmail(email))
    return NextResponse.redirect(`${origin}/login?error=domain`, 303)

  const { supabase, applyCookies } = createRouteClient(request)
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: derivedPassword(email),
  })
  // Unknown email → send them to signup with the email pre-filled
  if (error)
    return NextResponse.redirect(
      `${origin}/signup?error=notfound&email=${encodeURIComponent(email)}`, 303)
  return applyCookies(NextResponse.redirect(`${origin}/picks`, 303))
}
