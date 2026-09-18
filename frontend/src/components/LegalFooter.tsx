import { Link } from 'react-router-dom'

import { LogoMark } from './Logo'

// Impressum must be reachable from every page (§5 DDG), not just the
// landing page — so this goes on every top-level page, not one shared
// layout wrapper (none exists yet, see ADR-0013/0014).
export function LegalFooter() {
  return (
    <footer className="mx-auto mt-12 flex w-full max-w-2xl flex-col items-center gap-4 border-t border-border px-4 py-8 text-center">
      <Link to="/" className="flex items-center gap-2 text-ink-soft hover:text-ink" aria-label="SKS Lotse – Startseite">
        <LogoMark className="h-5 w-5" />
        <span className="font-mono text-xs tracking-wide uppercase">SKS Lotse</span>
      </Link>
      <p className="font-mono text-[11px] text-ink-soft">© {new Date().getFullYear()} SKS Lotse</p>
      <p className="max-w-md text-xs text-ink-soft">
        Quelle der Prüfungsfragen und Musterantworten: amtlicher Fragenkatalog SKS, Wasserstraßen- und
        Schifffahrtsverwaltung des Bundes (WSV), bereitgestellt über{' '}
        <a href="https://www.elwis.de" target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">
          ELWIS
        </a>
        .
      </p>
      <nav className="flex gap-4 font-mono text-xs text-ink-soft uppercase">
        <Link to="/imprint" className="hover:text-ink">
          Impressum
        </Link>
        <Link to="/privacy" className="hover:text-ink">
          Datenschutz
        </Link>
      </nav>
    </footer>
  )
}
