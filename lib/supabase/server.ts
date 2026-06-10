import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Read-only Supabase client for Server Components (pages). Never sets cookies.
export async function createServerComponentClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {}, // server components cannot set cookies; route handlers do that
      },
    },
  )
}
