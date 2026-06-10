import Link from 'next/link'
import OfficeSelect from './OfficeSelect'

const ERRORS: Record<string, string> = {
  domain: 'Please use your @focalpm.com email address.',
  missing: 'Please fill in your full name and office.',
  notfound: 'We don’t know that email yet — add your name and office below to join.',
  failed: 'Sign-up failed. Please try again or contact the organiser.',
}

const inputCls =
  'w-full rounded border border-[#3A4A6B] bg-[#011541] px-3 py-2.5 text-white outline-none transition placeholder:text-[#5A6F9E] focus:border-[#1D4EC6]'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string }>
}) {
  const { error, email } = await searchParams
  return (
    <div className="mx-auto mt-16 max-w-md">
      <p className="text-center text-xs font-bold uppercase tracking-[0.3em] text-[#7585AE]">Focal Middle East</p>
      <h1 className="mt-2 text-center text-3xl font-normal tracking-tight text-white">Join the competition</h1>
      <p className="mt-3 text-center text-sm text-[#9AA7CC]">Build a squad of four countries. Watch them climb. Win cash.</p>

      {error && ERRORS[error] && (
        <div className="mt-6 rounded border border-[#1D4EC6]/60 bg-[#0F2A63]/60 px-4 py-3 text-sm text-[#E7ECFA]">
          {ERRORS[error]}
        </div>
      )}

      <form action="/api/auth/signup" method="POST" className="mt-8 space-y-4 rounded-lg border border-[#1d3464] bg-[#0A2050] p-6">
        <div>
          <label htmlFor="full_name" className="mb-1.5 block text-xs uppercase tracking-wider text-[#9AA7CC]">Full name</label>
          <input id="full_name" name="full_name" required placeholder="As it should appear on the leaderboard" className={inputCls} />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs uppercase tracking-wider text-[#9AA7CC]">Company email</label>
          <input id="email" name="email" type="email" required placeholder="you@focalpm.com" pattern=".*@focalpm\.com$"
            title="Must be an @focalpm.com address" defaultValue={email ?? ''} className={inputCls} />
        </div>
        <OfficeSelect />
        <button className="w-full rounded bg-[#1D4EC6] py-2.5 font-semibold text-white transition hover:bg-[#173E9E]">
          Join the game
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-[#9AA7CC]">
        Already registered? <Link href="/login" className="font-bold text-[#E7ECFA] underline-offset-4 hover:underline">Log in</Link>
      </p>
    </div>
  )
}
