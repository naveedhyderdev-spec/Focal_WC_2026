import { type PrizeResult } from '@/lib/prizes'

// The "Winner Board": all five prizes, their cash amount, when each is
// announced, the winner (or current leader / pending), WHY they're there,
// and a hover tooltip explaining what each prize means. Presentational.
export default function WinnerBoard({ prizes }: { prizes: PrizeResult[] }) {
  return (
    <section className="mt-10">
      <h2 className="mb-1 text-center text-lg font-semibold text-white">Prizes &amp; Winners</h2>
      <p className="mb-5 text-center text-xs text-[#86868b]">
        Five prizes · $1,000 pot · each shows its current leader · one cash prize per person, settled at the Final · hover ⓘ for how each is won
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {prizes.map(p => (
          <div key={p.key}
            className={`rounded-xl border px-5 py-4 ${p.status === 'won' ? 'border-[#E8B23A]/50 bg-[#E8B23A]/[0.07]' : 'border-[#2a2a2d] bg-[#161618]'}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex items-center gap-1.5 font-heading text-sm font-semibold text-[#f5f5f7]">
                {p.label}
                {/* hover tooltip: what this prize means */}
                <span className="group relative inline-flex">
                  <span className="cursor-help text-[11px] text-[#86868b] hover:text-[#d2d2d7]">ⓘ</span>
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 hidden w-60 -translate-x-1/2 rounded-md border border-[#3a3a3d] bg-black px-3 py-2 text-xs font-normal leading-relaxed text-[#d2d2d7] shadow-lg group-hover:block">
                    {p.explainer}
                  </span>
                </span>
              </span>
              <span className="font-heading text-base font-bold text-[#E8B23A]">${p.amount}</span>
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-wider text-[#86868b]">{p.schedule}</div>
            <div className="mt-3 border-t border-[#2a2a2d] pt-3">
              {p.status !== 'pending' && p.names.length > 0 ? (
                <>
                  <div className="flex items-start gap-2">
                    {(() => {
                      const shown = p.names.slice(0, 3).join(' & ') + (p.names.length > 3 ? ` +${p.names.length - 3} more` : '')
                      return p.status === 'won'
                        ? <><span className="text-lg leading-tight">🏆</span><span className="font-heading text-base font-semibold leading-tight text-white">{shown}</span></>
                        : <span className="text-sm text-[#d2d2d7]"><span className="text-[#86868b]">Leading:</span> {shown}</span>
                    })()}
                  </div>
                  <div className="mt-1 text-xs text-[#86868b]">
                    {p.reason}{p.status === 'leading' && ' · provisional'}
                  </div>
                </>
              ) : (
                <div className="text-sm text-[#86868b]">To be announced</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
