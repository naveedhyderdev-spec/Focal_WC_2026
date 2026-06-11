import Link from 'next/link'
import DeadlineBanner from '@/components/DeadlineBanner'
import { PICK_DEADLINE } from '@/lib/config'

const ERRORS: Record<string, string> = {
  domain: 'Please use your @focalpm.com email address.',
  session: 'Your session expired — please log in again.',
}

const inputCls =
  'w-full rounded border border-[#3a3a3d] bg-[#0a0a0a] px-3 py-2.5 text-white outline-none transition placeholder:text-[#6e6e73] focus:border-[#f5f5f7]'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <div className="mx-auto mt-10 max-w-md">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/trophy.png" alt="FIFA World Cup trophy"
        className="animate-float mx-auto h-44 w-auto" />
      <p className="animate-risein mt-8 text-center text-xs font-bold uppercase tracking-[0.3em] text-[#86868b]">Focal Middle East</p>
      <h1 className="animate-risein mt-2 text-center text-4xl font-semibold tracking-tight text-white">World Cup 2026</h1>
      <p className="animate-risein-1 mt-3 text-center text-sm text-[#a1a1a6]">
        Already joined? Just enter your <span className="text-[#f5f5f7]">@focalpm.com</span> email — no password needed
      </p>
      <DeadlineBanner deadlineIso={PICK_DEADLINE.toISOString()} />

      {error && ERRORS[error] && (
        <div className="mt-6 rounded border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {ERRORS[error]}
        </div>
      )}

      <form action="/api/auth/login" method="POST" className="animate-risein-2 mt-8 space-y-4 rounded-xl border border-[#2a2a2d] bg-[#161618] p-6">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs uppercase tracking-wider text-[#a1a1a6]">Email</label>
          <input id="email" name="email" type="email" required placeholder="you@focalpm.com" className={inputCls} />
        </div>
        <button className="w-full rounded bg-[#f5f5f7] py-2.5 font-semibold text-black transition hover:bg-white">
          Continue
        </button>
      </form>

      <div className="animate-risein-3 mt-6 rounded-xl border border-[#2a2a2d] bg-[#161618]/60 p-5 text-center">
        <p className="text-sm leading-relaxed text-[#a1a1a6]">
          <span className="font-bold text-[#f5f5f7]">Logging in for the first time?</span><br />
          Sign up once with your full name, company email and office location.
          From then on, you log in with just your email.
        </p>
        <Link href="/signup"
          className="mt-4 inline-block rounded border border-white px-6 py-2.5 font-heading text-sm font-semibold text-white transition hover:bg-white hover:text-black">
          Sign up
        </Link>
      </div>
    </div>
  )
}
