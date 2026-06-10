'use client'

import { useState } from 'react'
import { OFFICES } from '@/lib/config'

// Pure UI state (which option is highlighted) — the actual values still
// submit through the parent <form> POST, per the no-client-mutations rule.
export default function OfficeSelect() {
  const [office, setOffice] = useState<string>('')
  return (
    <div className="pt-1">
      <label htmlFor="office_location" className="mb-2 block text-xs uppercase tracking-wider text-[#a1a1a6]">
        Office location
      </label>
      <div className="relative">
        <select
          id="office_location" name="office_location" required value={office}
          onChange={e => setOffice(e.target.value)}
          className="w-full cursor-pointer appearance-none rounded border border-[#3a3a3d] bg-[#0a0a0a] py-3 pl-4 pr-10 text-white outline-none transition focus:border-[#f5f5f7]"
        >
          <option value="" disabled>Select your office…</option>
          {OFFICES.map(o => <option key={o} value={o}>{o}</option>)}
          <option value="Other">Other…</option>
        </select>
        {/* custom chevron so the native arrow doesn't crowd the text */}
        <svg className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a1a1a6]"
          viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </div>
      {office === 'Other' && (
        <input
          name="office_other" required placeholder="Where are you based?"
          className="mt-3 w-full rounded border border-[#3a3a3d] bg-[#0a0a0a] py-3 pl-4 pr-4 text-white outline-none transition placeholder:text-[#86868b] focus:border-[#f5f5f7]"
        />
      )}
    </div>
  )
}
