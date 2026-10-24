import { Link } from 'react-router-dom'

import { BAND_CONTENT as CONTENT, Columns } from '../components/Bands'
import { HeaderBar } from '../components/HeaderBar'
import { HeroBand } from '../components/HeroBand'
import { LegalFooter } from '../components/LegalFooter'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { sbfNavigationOpen } from '../siteConfig'
import { SbfHeaderNav } from './SbfHeaderNav'
import { SBF_HOME_TITLE } from './texts'

const SOON_BADGE = 'rounded-tile bg-accent-strong px-2 py-0.5 font-mono text-xs tracking-wide text-surface uppercase'

// What SBF Lotse is going to offer, first things first (ADR-0067). While VITE_SBF is "off" the
// start page is all there is: no task content, no API call. With "on" the first item is there.
const COMING = [
  [
    'Navigationsaufgaben See',
    'Die 15 amtlichen Navigationsaufgaben, Teilaufgabe für Teilaufgabe: deine Antwort, das amtliche Ergebnis und am Ende die Auswertung nach dem Bewertungsschlüssel – ohne Anmeldung.',
    'Als Erstes',
  ],
  ['Fragenkatalog', 'Die amtlichen Prüfungsfragen für den SBF See und den SBF Binnen.', 'Später'],
  [
    'Konto und Lotsen-Check',
    'Deinen Fortschritt auf jedem Gerät behalten und dir von der KI eine Bewertung deiner Antwort vorschlagen lassen.',
    'Später',
  ],
]

export function SbfLandingPage() {
  useDocumentTitle(SBF_HOME_TITLE)
  const open = sbfNavigationOpen()
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <HeaderBar homeTo="/" nav={<SbfHeaderNav />} />

      <main className="flex-1">
        <HeroBand className="pt-20 pb-36 text-center sm:pb-44">
          <div className={`flex flex-col items-center ${CONTENT} max-w-2xl`}>
            <h1 className="font-serif text-4xl tracking-wide break-words uppercase sm:text-5xl">
              Sicher durch die SBF-Theorie
            </h1>
            <p className="mt-8 text-lg tracking-wide text-surface-alt uppercase sm:text-xl">
              Die Lern-App für den Sportbootführerschein See – im Aufbau
            </p>
            {open ? (
              <Link
                to="/navigation"
                className="mt-10 rounded-tile border-2 border-surface px-6 py-3 font-mono text-sm tracking-wide text-surface uppercase transition hover:bg-surface hover:text-primary"
              >
                Navigationsaufgaben üben
              </Link>
            ) : (
              <p className="mt-6 text-sm text-surface-alt">
                Bald hier: die amtlichen Navigationsaufgaben See, frei zum Üben.
              </p>
            )}
          </div>
        </HeroBand>

        <section className={`${CONTENT} py-16`}>
          <h2 className="font-serif text-3xl text-primary">Was kommt</h2>
          <Columns className="mt-10 sm:grid-cols-3">
            {COMING.map(([title, text, when], index) => (
              <div key={title} className="flex flex-col items-start gap-4">
                {/* The first item is the Navigationsaufgaben: there in a build with VITE_SBF=on. */}
                <span className={SOON_BADGE}>{open && index === 0 ? 'Jetzt da' : when}</span>
                <h3 className="font-serif text-2xl leading-snug text-primary">
                  {open && index === 0 ? (
                    <Link to="/navigation" className="underline-offset-4 hover:underline">
                      {title}
                    </Link>
                  ) : (
                    title
                  )}
                </h3>
                <p className="text-sm leading-relaxed text-ink-soft">{text}</p>
              </div>
            ))}
          </Columns>
          <Link to="/faq" className="mt-10 inline-block text-primary underline hover:no-underline">
            Mehr in den häufigen Fragen
          </Link>
        </section>

        <section className="bg-primary py-16 text-surface">
          <div className={CONTENT}>
            <h2 className="font-serif text-3xl">Der nächste Schritt: SKS</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-surface-alt">
              Mit dem SBF See in der Tasche geht es weiter zum Sportküstenschifferschein. Für dessen Theorie gibt es SKS
              Lotse: der komplette amtliche Fragenkatalog, Probeprüfung und Kartenaufgaben.
            </p>
            <a
              href="https://sks-lotse.de"
              className="mt-6 inline-block rounded-tile border-2 border-surface px-6 py-3 font-mono text-sm tracking-wide uppercase transition hover:bg-surface hover:text-primary"
            >
              Zu SKS Lotse
            </a>
          </div>
        </section>
      </main>

      <LegalFooter />
    </div>
  )
}
