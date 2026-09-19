import { Link } from 'react-router-dom'

import { LogoMark } from './Logo'

// Impressum must be reachable from every page (§5 DDG) — the landing page
// renders this directly, every other page gets it via PageLayout. A
// full-width primary-dark band, the bottom of the banded layout.
export function LegalFooter() {
  return (
    <footer className="bg-primary-dark">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 py-8 text-center text-surface-alt">
        <Link to="/" className="flex items-center gap-2 hover:text-surface" aria-label="SKS Lotse – Startseite">
          <LogoMark className="h-5 w-5" />
          <span className="font-mono text-xs tracking-wide uppercase">SKS Lotse</span>
        </Link>
        <p className="font-mono text-[11px]">© {new Date().getFullYear()} SKS Lotse</p>
        <p className="max-w-md text-xs">
          Quelle der Prüfungsfragen und Musterantworten: amtlicher Fragenkatalog SKS, Wasserstraßen- und
          Schifffahrtsverwaltung des Bundes (WSV), bereitgestellt über{' '}
          <a
            href="https://www.elwis.de"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-surface"
          >
            ELWIS
          </a>
          .
        </p>
        <nav className="flex gap-4 font-mono text-xs uppercase">
          <Link to="/imprint" className="hover:text-surface">
            Impressum
          </Link>
          <Link to="/privacy" className="hover:text-surface">
            Datenschutz
          </Link>
        </nav>
      </div>
    </footer>
  )
}
