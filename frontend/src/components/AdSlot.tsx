// The "ad slot" pattern from ADR-0014: a dashed-border placeholder,
// deliberately styled to look distinct from app content, never native.
// First real use is the landing page's free-tier pricing card; the same
// component is meant for Start/Fragenliste/Frage beantworten/Bewertung
// once those exist.
export function AdSlot() {
  return (
    <div className="flex h-20 items-center justify-center border border-dashed border-border font-mono text-xs tracking-wide text-ink-soft uppercase">
      Anzeige
    </div>
  )
}
