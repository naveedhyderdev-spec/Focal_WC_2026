import { NextResponse, type NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { isAllowedEmail } from '@/lib/config'
import { derivedPassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const email = String(form.get('email') ?? '').trim()
  const fullName = String(form.get('full_name') ?? '').trim()
  const office = String(form.get('office_location') ?? '').trim()
  const officeOther = String(form.get('office_other') ?? '').trim()
  const officeLocation = office === 'Other' ? officeOther : office
  const origin = new URL(request.url).origin

  if (!isAllowedEmail(email))
    return NextResponse.redirect(`${origin}/signup?error=domain`, 303)
  if (!fullName || !officeLocation)
    return NextResponse.redirect(`${origin}/signup?error=missing`, 303)

  const { supabase, applyCookies } = createRouteClient(request)
  const password = derivedPassword(email)
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, office_location: officeLocation } },
  })
  if (error) {
    // Already registered → just log them in (same derived password)
    if (error.message.toLowerCase().includes('already')) {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
      if (!loginError)
        return applyCookies(NextResponse.redirect(`${origin}/picks`, 303))
    }
    return NextResponse.redirect(`${origin}/signup?error=failed`, 303)
  }
  return applyCookies(NextResponse.redirect(`${origin}/picks`, 303))
}
