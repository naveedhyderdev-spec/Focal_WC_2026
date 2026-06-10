import Link from 'next/link'

const ERRORS: Record<string, string> = {
  domain: 'Please use your @focalpm.com email address.',
  session: 'Your session expired — please log in again.',
}

const inputCls =
  'w-full rounded border border-[#3A4A6B] bg-[#011541] px-3 py-2.5 text-white outline-none transition placeholder:text-[#5A6F9E] focus:border-[#1D4EC6]'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <div className="mx-auto mt-16 max-w-md">
      <p className="text-center text-xs font-bold uppercase tracking-[0.3em] text-[#7585AE]">Focal Middle East</p>
      <h1 className="mt-2 text-center text-3xl font-normal tracking-tight text-white">World Cup 2026</h1>
      <p className="mt-3 text-center text-sm text-[#9AA7CC]">
        Already joined? Just enter your <span className="text-[#E7ECFA]">@focalpm.com</span> email — no password needed
      </p>

      {error && ERRORS[error] && (
        <div className="mt-6 rounded border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {ERRORS[error]}
        </div>
      )}

      <form action="/api/auth/login" method="POST" className="mt-8 space-y-4 rounded-lg border border-[#1d3464] bg-[#0A2050] p-6">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs uppercase tracking-wider text-[#9AA7CC]">Email</label>
          <input id="email" name="email" type="email" required placeholder="you@focalpm.com" className={inputCls} />
        </div>
        <button className="w-full rounded bg-[#1D4EC6] py-2.5 font-semibold text-white transition hover:bg-[#173E9E]">
          Continue
        </button>
      </form>

      <div className="mt-6 rounded-lg border border-[#1d3464] bg-[#0A2050]/60 p-5 text-center">
        <p className="text-sm leading-relaxed text-[#9AA7CC]">
          <span className="font-bold text-[#E7ECFA]">Logging in for the first time?</span><br />
          Sign up once with your full name, company email and office location.
          From then on, you log in with just your email.
        </p>
        <Link href="/signup"
          className="mt-4 inline-block rounded border border-[#1D4EC6] px-6 py-2.5 font-heading text-sm font-semibold text-white transition hover:bg-[#1D4EC6]">
          Sign up
        </Link>
      </div>
    </div>
  )
}
