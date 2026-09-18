interface LedgerRowProps {
  title: string
  learned: number
  total: number
}

// The "ledger list rows" pattern from ADR-0014: flat rows separated by
// hairlines (not boxed cards), counts set in IBM Plex Mono. Used for the
// per-topic Lernstand list on /lernen. "Lernen starten" stays disabled —
// actually answering questions isn't built yet (see ADR-0018).
export function LedgerRow({ title, learned, total }: LedgerRowProps) {
  const percent = total > 0 ? Math.round((learned / total) * 100) : 0

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <div className="flex-1">
        <p className="text-ink">{title}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1 w-20 bg-surface-alt">
            <div className="h-full bg-success" style={{ width: `${percent}%` }} />
          </div>
          <p className="font-mono text-xs text-ink-soft">
            {learned} von {total} Fragen gelernt
          </p>
        </div>
      </div>
      <button
        type="button"
        disabled
        className="border border-border px-3 py-1.5 font-mono text-xs tracking-wide text-ink-soft uppercase disabled:cursor-not-allowed"
      >
        Lernen starten
      </button>
    </div>
  )
}
