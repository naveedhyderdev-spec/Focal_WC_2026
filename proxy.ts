import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Official @supabase/ssr session-refresh middleware (Next 16 "proxy").
// Keeps long-lived sessions alive: refreshes expired access tokens and
// writes the rotated cookies back to BOTH the forwarded request and the
// response, so server components always see a valid session and the
// browser always holds the latest refresh token. Without this, sessions
// die ~1 hour after login. Cookies: Secure on HTTPS, SameSite=Lax default.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
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
          for (const { name, value } of cookiesToSet)
            request.cookies.set(name, value)
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet)
            response.cookies.set(name, value, {
              ...(options ?? {}),
              ...(isHttps ? { secure: true } : {}),
            })
        },
      },
    },
  )

  // IMPORTANT: getUser() triggers the token refresh; do not remove.
  await supabase.auth.getUser()

  return response
}

export const config = {
  // Run on pages only — skip static assets and images. API routes manage
  // their own cookies via createRouteClient.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:png|svg|jpg|jpeg|gif|webp)$).*)'],
}
