import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

import { openConsentSettings, useShowAds } from '../ads'
import { FEEDBACK_MAILTO } from '../contact'

const FOOTER_LINK = 'border-b-2 border-transparent pb-1 hover:border-surface hover:text-surface'

// The page the visitor is on is underlined, like the header's links (HEADER_LINK_ACTIVE).
function footerLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'border-b-2 border-surface pb-1 text-surface' : FOOTER_LINK
}

// Impressum must be reachable from every page (§5 DDG) — the landing page
// renders this directly, every other page gets it via PageLayout. A
// full-width primary-dark band with the brand centered on top, like the
// template's footer.
export function LegalFooter() {
  const showAds = useShowAds()
  const [consentUnavailable, setConsentUnavailable] = useState(false)

  function handleConsentClick() {
    setConsentUnavailable(false)
    openConsentSettings(() => setConsentUnavailable(true))
  }

  return (
    <footer className="bg-primary-dark">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 px-4 py-8 text-center text-surface-alt">
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 font-mono text-xs tracking-wide uppercase">
          <NavLink to="/imprint" className={footerLinkClass}>
            Impressum
          </NavLink>
          <NavLink to="/privacy" className={footerLinkClass}>
            Datenschutz
          </NavLink>
          <NavLink to="/terms" className={footerLinkClass}>
            AGB
          </NavLink>
          <a href={FEEDBACK_MAILTO} className={FOOTER_LINK}>
            Kontakt
          </a>
          {showAds && (
            <button
              type="button"
              onClick={handleConsentClick}
              className={`${FOOTER_LINK} font-mono tracking-wide uppercase`}
            >
              Cookies
            </button>
          )}
        </nav>
        {consentUnavailable ? (
          <p role="status" className="max-w-md text-xs text-surface">
            Googles Einstellungsdialog lässt sich gerade nicht laden, z. B. wegen eines Werbeblockers. Solange er nicht
            lädt, setzt Google auch keine Cookies. Mehr dazu in der{' '}
            <Link to="/privacy#werbung" className="underline hover:text-surface-alt">
              Datenschutzerklärung
            </Link>
            .
          </p>
        ) : null}
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
