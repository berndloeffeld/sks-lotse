import { Link } from 'react-router-dom'

import { LogoMark } from './Logo'

// Impressum must be reachable from every page (§5 DDG) — the landing page
// renders this directly, every other page gets it via PageLayout. A
// full-width primary-dark band with the brand centered on top, like the
// template's footer.
export function LegalFooter() {
  return (
    <footer className="bg-primary-dark">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 px-4 py-12 text-center text-surface-alt">
        <Link
          to="/"
          className="flex flex-col items-center gap-2 text-surface hover:opacity-80"
          aria-label="SKS Lotse – Startseite"
        >
          <LogoMark className="h-14 w-14" />
          <span className="font-serif text-2xl">SKS Lotse</span>
        </Link>
        <nav className="flex gap-6 font-mono text-xs tracking-wide uppercase">
          <Link to="/imprint" className="border-b-2 border-transparent pb-1 hover:border-surface hover:text-surface">
            Impressum
          </Link>
          <Link to="/privacy" className="border-b-2 border-transparent pb-1 hover:border-surface hover:text-surface">
            Datenschutz
          </Link>
        </nav>
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
      </div>
    </footer>
  )
}
