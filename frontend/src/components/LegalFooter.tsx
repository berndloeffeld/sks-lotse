import { Link } from 'react-router-dom'

import { adsEnabled, openConsentSettings } from '../ads'
import { FEEDBACK_MAILTO } from '../contact'

// Impressum must be reachable from every page (§5 DDG) — the landing page
// renders this directly, every other page gets it via PageLayout. A
// full-width primary-dark band with the brand centered on top, like the
// template's footer.
export function LegalFooter() {
  return (
    <footer className="bg-primary-dark">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 px-4 py-8 text-center text-surface-alt">
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 font-mono text-xs tracking-wide uppercase">
          <Link to="/imprint" className="border-b-2 border-transparent pb-1 hover:border-surface hover:text-surface">
            Impressum
          </Link>
          <Link to="/privacy" className="border-b-2 border-transparent pb-1 hover:border-surface hover:text-surface">
            Datenschutz
          </Link>
          <a
            href={FEEDBACK_MAILTO}
            className="border-b-2 border-transparent pb-1 hover:border-surface hover:text-surface"
          >
            Feedback
          </a>
          {adsEnabled() && (
            <button
              type="button"
              onClick={openConsentSettings}
              className="border-b-2 border-transparent pb-1 font-mono tracking-wide uppercase hover:border-surface hover:text-surface"
            >
              Cookie-Einstellungen
            </button>
          )}
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
