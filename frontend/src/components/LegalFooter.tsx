import { Link } from 'react-router-dom'

// Impressum must be reachable from every page (§5 DDG), not just the
// landing page — so this goes on every top-level page, not one shared
// layout wrapper (none exists yet, see ADR-0013/0014).
export function LegalFooter() {
  return (
    <footer className="mx-auto flex max-w-2xl justify-center gap-4 px-4 py-6 font-mono text-xs text-ink-soft uppercase">
      <Link to="/impressum" className="hover:text-ink">
        Impressum
      </Link>
      <Link to="/datenschutz" className="hover:text-ink">
        Datenschutz
      </Link>
    </footer>
  )
}
