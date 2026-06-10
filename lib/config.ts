// ============================================================
// All tunable app settings live here.
// ============================================================

/** Picks lock at first kickoff (Dubai time). */
export const PICK_DEADLINE = new Date('2026-06-11T18:00:00+04:00')

/** Only this email domain may register / log in. */
export const ALLOWED_EMAIL_DOMAIN = '@focalpm.com'

/** Office choices shown at signup ("Other…" reveals a free-text box). */
export const OFFICES = ['UAE', 'India', 'Sri Lanka'] as const

export const APP_NAME = 'Focal World Cup 2026'

export const TOURNAMENT_DATES = '11 June – 19 July 2026'

export function isDeadlinePassed(now: Date = new Date()): boolean {
  return now >= PICK_DEADLINE
}

/** Locale-independent deadline string (avoids hydration mismatches). */
export function formatDeadline(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(PICK_DEADLINE)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')} Dubai time`
}
