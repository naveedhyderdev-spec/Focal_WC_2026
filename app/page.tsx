import { redirect } from 'next/navigation'
import { createServerComponentClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createServerComponentClient()
  const { data: { user } } = await supabase.auth.getUser()
  redirect(user ? '/picks' : '/login')
}
