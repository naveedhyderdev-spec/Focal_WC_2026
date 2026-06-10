import { createServerClient } from '@supabase/ssr'
import type { NextRequest, NextResponse } from 'next/server'

// Route-handler Supabase client. Collects the cookies Supabase wants to set
// and applies them to the redirect response we return. Secure on HTTPS,
// default SameSite=Lax — the v1-proof pattern.
export function createRouteClient(request: NextRequest) {
  const toSet: { name: string; value: string; options: Record<string, unknown> }[] = []
  const isHttps =
    new URL(request.url).protocol === 'https:' ||
    request.headers.get('x-forwarded-proto') === 'https'

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const c of cookiesToSet)
            toSet.push({
              name: c.name,
              value: c.value,
              options: { ...(c.options ?? {}), ...(isHttps ? { secure: true } : {}) },
            })
        },
      },
    },
  )

  const applyCookies = (response: NextResponse) => {
    for (const { name, value, options } of toSet) response.cookies.set(name, value, options)
    return response
  }
  return { supabase, applyCookies }
}
