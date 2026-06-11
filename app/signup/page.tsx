import Link from 'next/link'
import OfficeSelect from './OfficeSelect'

const ERRORS: Record<string, string> = {
  domain: 'Please use your @focalpm.com email address.',
  missing: 'Please fill in your full name and office.',
  notfound: 'We don’t know that email yet — add your name and office below to join.',
  failed: 'Sign-up failed. Please try again or contact the organiser.',
}

const inputCls =
  'w-full rounded border border-[#3a3a3d] bg-[#0a0a0a] px-3 py-2.5 text-white outline-none transition placeholder:text-[#6e6e73] focus:border-[#f5f5f7]'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string }>
}) {
  const { error, email } = await searchParams
  return (
    <div className="mx-auto mt-16 max-w-md">
      <p className="text-center text-xs font-bold uppercase tracking-[0.3em] text-[#86868b]">Focal Middle East</p>
      <h1 className="mt-2 text-center text-3xl font-normal tracking-tight text-white">Join the competition</h1>
      <p className="mt-3 text-center text-sm text-[#a1a1a6]">Build a squad of four countries. Watch them climb. Win cash.</p>

      {error && ERRORS[error] && (
        <div className="mt-6 rounded border border-[#5a5a5e] bg-[#1d1d1f]/60 px-4 py-3 text-sm text-[#f5f5f7]">
          {ERRORS[error]}
        </div>
      )}

      <form action="/api/auth/signup" method="POST" className="mt-8 space-y-4 rounded-lg border border-[#2a2a2d] bg-[#161618] p-6">
        <div>
          <label htmlFor="full_name" className="mb-1.5 block text-xs uppercase tracking-wider text-[#a1a1a6]">Full name</label>
          <input id="full_name" name="full_name" required placeholder="As it should appear on the leaderboard" className={inputCls} />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs uppercase tracking-wider text-[#a1a1a6]">Company email</label>
          <input id="email" name="email" type="email" required placeholder="you@focalpm.com"
            title="Use your @focalpm.com address" defaultValue={email ?? ''} className={inputCls} />
        </div>
        <OfficeSelect />
        <button className="w-full rounded bg-[#f5f5f7] py-2.5 font-semibold text-black transition hover:bg-white">
          Join the game
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-[#a1a1a6]">
        Already registered? <Link href="/login" className="font-bold text-[#f5f5f7] underline-offset-4 hover:underline">Log in</Link>
      </p>
    </div>
  )
}
