import { Link } from 'react-router-dom'

import { LogoMark } from './Logo'

// Impressum must be reachable from every page (§5 DDG), not just the
// landing page — so this goes on every top-level page, not one shared
// layout wrapper (none exists yet, see ADR-0013/0014).
interface LegalFooterProps {
  // `dark` renders it as a full-width primary-dark band, for pages built
  // from colored bands (the landing page); `light` is the plain hairline
  // footer every other page uses.
  tone?: 'light' | 'dark'
}

export function LegalFooter({ tone = 'light' }: LegalFooterProps) {
  const dark = tone === 'dark'
  const soft = dark ? 'text-surface-alt' : 'text-ink-soft'
  const hover = dark ? 'hover:text-surface' : 'hover:text-ink'
  const footer = (
    <footer
      className={`mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 py-8 text-center ${dark ? '' : 'mt-12 border-t border-border'}`}
    >
      <Link to="/" className={`flex items-center gap-2 ${soft} ${hover}`} aria-label="SKS Lotse – Startseite">
        <LogoMark className="h-5 w-5" />
        <span className="font-mono text-xs tracking-wide uppercase">SKS Lotse</span>
      </Link>
      <p className={`font-mono text-[11px] ${soft}`}>© {new Date().getFullYear()} SKS Lotse</p>
      <p className={`max-w-md text-xs ${soft}`}>
        Quelle der Prüfungsfragen und Musterantworten: amtlicher Fragenkatalog SKS, Wasserstraßen- und
        Schifffahrtsverwaltung des Bundes (WSV), bereitgestellt über{' '}
        <a href="https://www.elwis.de" target="_blank" rel="noopener noreferrer" className={`underline ${hover}`}>
          ELWIS
        </a>
        .
      </p>
      <nav className={`flex gap-4 font-mono text-xs uppercase ${soft}`}>
        <Link to="/imprint" className={hover}>
          Impressum
        </Link>
        <Link to="/privacy" className={hover}>
          Datenschutz
        </Link>
      </nav>
    </footer>
  )
  return dark ? <div className="bg-primary-dark">{footer}</div> : footer
}
