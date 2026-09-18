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
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <div>
        <p className="text-ink">{title}</p>
        <p className="font-mono text-xs text-ink-soft">
          {learned} von {total} Fragen gelernt
        </p>
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
