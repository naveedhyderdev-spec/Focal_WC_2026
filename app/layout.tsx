import type { Metadata } from 'next'
import { Poppins, Montserrat } from 'next/font/google'
import Image from 'next/image'
import './globals.css'
import { APP_NAME } from '@/lib/config'
import { createServerComponentClient } from '@/lib/supabase/server'
import Link from 'next/link'

const poppins = Poppins({
  weight: ['300', '400', '600'],
  subsets: ['latin'],
  variable: '--font-poppins',
})
const montserrat = Montserrat({
  weight: ['300', '400', '700'],
  subsets: ['latin'],
  variable: '--font-montserrat',
})

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'Focal Middle East — The Focal World Cup 2026',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerComponentClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="en" className={`${poppins.variable} ${montserrat.variable}`}>
      <body className="flex min-h-screen flex-col bg-[#011541] text-white antialiased">
        <header className="sticky top-0 z-40 border-b border-[#1d3464] bg-[#011541]/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/focal-logo-secondary-white-on-blue.png"
                alt="Focal" width={50} height={40} priority
                className="h-10 w-auto"
              />
              <span className="font-heading text-sm font-semibold uppercase tracking-[0.18em] text-white">
                World Cup 2026
              </span>
            </Link>
            <nav className="flex items-center gap-5 text-sm">
              <Link href="/how-to-play" className="text-[#C5CFE8] transition hover:text-white">Rules</Link>
              {user ? (
                <>
                  <Link href="/picks" className="text-[#C5CFE8] transition hover:text-white">My Picks</Link>
                  <Link href="/leaderboard" className="text-[#C5CFE8] transition hover:text-white">Leaderboard</Link>
                  <form action="/api/auth/logout" method="POST">
                    <button className="rounded border border-[#3A4A6B] px-3 py-1.5 text-[#C5CFE8] transition hover:border-[#5A6F9E] hover:text-white">
                      Log out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/leaderboard" className="text-[#C5CFE8] transition hover:text-white">Leaderboard</Link>
                  <Link href="/login" className="rounded bg-[#1D4EC6] px-4 py-1.5 font-heading font-semibold text-white transition hover:bg-[#173E9E]">
                    Log in
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">{children}</main>
        <footer className="border-t border-[#1d3464] py-6">
          <p className="text-center text-xs tracking-wide text-[#7585AE]">
            Focal Middle East&ensp;|&ensp;The Focal World Cup 2026&ensp;·&ensp;We put the pieces together
          </p>
        </footer>
      </body>
    </html>
  )
}
