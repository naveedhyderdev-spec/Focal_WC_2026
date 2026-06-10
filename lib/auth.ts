import { createHmac } from 'node:crypto'

// No-password login: users only enter their @focalpm.com email. The server
// derives a strong per-user password from the email + AUTH_SECRET, so the
// whole Supabase auth/cookie/RLS machinery stays untouched. SERVER ONLY.
export function derivedPassword(email: string): string {
  return createHmac('sha256', process.env.AUTH_SECRET!)
    .update(email.trim().toLowerCase())
    .digest('hex')
}
