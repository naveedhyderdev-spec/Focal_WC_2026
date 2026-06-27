import { type PrizeResult } from '@/lib/prizes'

// The "Winner Board": all five prizes, their cash amount, when each is
// announced, and the winner (or current leader / pending). Presentational.
export default function WinnerBoard({ prizes }: { prizes: PrizeResult[] }) {
  return (
    <section className="mt-10">
      <h2 className="mb-1 text-center text-lg font-semibold text-white">Prizes &amp; Winners</h2>
      <p className="mb-5 text-center text-xs text-[#86868b]">
        Five prizes · $1,000 pot · one prize per person
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {prizes.map(p => (
          <div key={p.key}
            className={`rounded-xl border px-5 py-4 ${p.status === 'won' ? 'border-[#E8B23A]/50 bg-[#E8B23A]/[0.07]' : 'border-[#2a2a2d] bg-[#161618]'}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-heading text-sm font-semibold text-[#f5f5f7]">{p.label}</span>
              <span className="font-heading text-base font-bold text-[#E8B23A]">${p.amount}</span>
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-wider text-[#86868b]">{p.schedule}</div>
            <div className="mt-3 border-t border-[#2a2a2d] pt-3">
              {p.status === 'won' && p.name ? (
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏆</span>
                  <span className="font-heading text-base font-semibold text-white">{p.name}</span>
                </div>
              ) : p.status === 'leading' && p.name ? (
                <div className="text-sm text-[#a1a1a6]">
                  <span className="text-[#86868b]">Leading:</span>{' '}
                  <span className="text-[#d2d2d7]">{p.name}</span>
                  <span className="ml-1 text-[11px] text-[#86868b]">(provisional)</span>
                </div>
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
