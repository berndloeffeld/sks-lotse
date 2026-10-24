import { NavLink } from 'react-router-dom'

import { feedbackMailto } from '../contact'
import { catalogSourceLine, siteIdentity } from '../siteConfig'

// `pt-1 -mt-1` and `min-w-6` make a short link ("FAQ", "AGB") a 24 px tap target without moving it.
const TAP_AREA = 'min-w-6 -mt-1 pt-1 text-center'
const FOOTER_LINK = `${TAP_AREA} border-b-2 border-transparent pb-1 hover:border-surface hover:text-surface`

// The page the visitor is on is underlined, like the header's links (HEADER_LINK_ACTIVE).
function footerLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? `${TAP_AREA} border-b-2 border-surface pb-1 text-surface` : FOOTER_LINK
}

// The content pages (Prüfungsablauf, Lernmethode, FAQ), the contact (also the way to send feedback) and the
// legal links — each site its own (site.ts) — and the other site, SBF Lotse and SKS Lotse linking each other. Impressum must be
// reachable from every page (§5 DDG) — the landing page
// renders this directly, every other page gets it via PageLayout. A
// full-width primary-dark band with the brand centered on top, like the
// template's footer.
export function LegalFooter() {
  const { name, footerLinks, sisterSite } = siteIdentity()
  const source = catalogSourceLine()
  return (
    <footer className="bg-primary-dark">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 px-4 py-8 text-center text-surface-alt">
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 font-mono text-xs tracking-wide uppercase">
          {footerLinks.map(({ to, label }) => (
            <NavLink key={to} to={to} className={footerLinkClass}>
              {label}
            </NavLink>
          ))}
          <a href={sisterSite.href} className={FOOTER_LINK}>
            {sisterSite.label}
          </a>
          <a href={feedbackMailto(name)} className={FOOTER_LINK}>
            Kontakt
          </a>
        </nav>
        <p className="font-mono text-2xs">
          © {new Date().getFullYear()} {name}
        </p>
        {source ? (
          <p className="max-w-md text-xs">
            {source}, Wasserstraßen- und Schifffahrtsverwaltung des Bundes (WSV), bereitgestellt über{' '}
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
        ) : null}
      </div>
    </footer>
  )
}
