/* Flag images via flagcdn.com (emoji flags don't render on Windows).
   Maps our FIFA 3-letter codes to ISO 3166 codes used by flagcdn. */

const FIFA_TO_ISO: Record<string, string> = {
  MEX: 'mx', RSA: 'za', KOR: 'kr', CZE: 'cz',
  CAN: 'ca', BIH: 'ba', QAT: 'qa', SUI: 'ch',
  BRA: 'br', MAR: 'ma', HAI: 'ht', SCO: 'gb-sct',
  USA: 'us', PAR: 'py', AUS: 'au', TUR: 'tr',
  GER: 'de', CUW: 'cw', CIV: 'ci', ECU: 'ec',
  NED: 'nl', JPN: 'jp', SWE: 'se', TUN: 'tn',
  BEL: 'be', EGY: 'eg', IRN: 'ir', NZL: 'nz',
  ESP: 'es', CPV: 'cv', KSA: 'sa', URU: 'uy',
  FRA: 'fr', SEN: 'sn', IRQ: 'iq', NOR: 'no',
  ARG: 'ar', ALG: 'dz', AUT: 'at', JOR: 'jo',
  POR: 'pt', COD: 'cd', UZB: 'uz', COL: 'co',
  ENG: 'gb-eng', CRO: 'hr', GHA: 'gh', PAN: 'pa',
}

export default function Flag({ code, size = 'md' }: { code: string; size?: 'sm' | 'md' | 'lg' }) {
  const iso = FIFA_TO_ISO[code]
  const cls = size === 'lg' ? 'h-9 w-12' : size === 'sm' ? 'h-3.5 w-5' : 'h-4 w-6'
  if (!iso) return <span className={`inline-block ${cls} rounded-sm bg-[#3A4A6B]`} />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w80/${iso}.png`}
      alt={`${code} flag`}
      loading="lazy"
      className={`inline-block ${cls} shrink-0 rounded-sm object-cover ring-1 ring-white/20`}
    />
  )
}
