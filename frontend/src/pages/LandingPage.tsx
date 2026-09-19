import type { ReactNode } from 'react'

import { AdSlot } from '../components/AdSlot'
import { ContourBackground } from '../components/ContourBackground'
import { Header } from '../components/Header'
import { HeroBand } from '../components/HeroBand'
import { AnswerIcon, CatalogIcon, FeedbackIcon } from '../components/icons/FeatureIcons'
import { LegalFooter } from '../components/LegalFooter'
import { LoginForm } from '../components/LoginForm'

// Banded layout after a website template: full-width color bands (light
// bg / primary / primary-dark) alternating down the page, a slanted hero
// edge, three-column text blocks, image-topped cards and a sign-up form
// band. Palette, type and square-cornered chrome stay per ADR-0014.

const CONTENT = 'mx-auto w-full max-w-4xl px-4'

function Columns({ children }: { children: ReactNode }) {
  return <div className="grid gap-10 sm:grid-cols-3 sm:gap-8">{children}</div>
}

const HERO_FEATURES = [
  { label: 'Originalfragen', icon: <CatalogIcon className="h-5 w-5" /> },
  { label: 'Antworten per Sprache', icon: <AnswerIcon className="h-5 w-5" /> },
  { label: 'KI-Feedback', icon: <FeedbackIcon className="h-5 w-5" /> },
]

const PLANS = [
  {
    kicker: 'Standard',
    title: 'Musterantwort',
    icon: <CatalogIcon className="h-16 w-16" />,
    text: 'Fragen üben und die amtliche Musterantwort direkt zum Vergleich sehen – mit Werbung finanziert.',
    ad: true,
  },
  {
    kicker: 'Erweiterung',
    title: 'KI-Bewertung',
    icon: <AnswerIcon className="h-16 w-16" />,
    text: 'Schreib oder sprich deine Antwort und erhalte eine Bewertung mit Erklärung, was gefehlt hat.',
    ad: false,
  },
  {
    kicker: 'Erweiterung',
    title: 'Werbefrei',
    icon: <FeedbackIcon className="h-16 w-16" />,
    text: 'Lernen ganz ohne Anzeigen – ruhig und konzentriert.',
    ad: false,
  },
]

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <Header />

      <main className="flex-1">
        <HeroBand className="pt-20 pb-36 text-center sm:pb-44">
          <div className={`flex flex-col items-center ${CONTENT} max-w-2xl`}>
            <h1 className="font-serif text-4xl tracking-wide break-words uppercase sm:text-5xl">
              Sicher durch die SKS-Theorie
            </h1>
            <p className="mt-8 text-lg tracking-wide text-surface-alt uppercase sm:text-xl">
              Mit den Originalfragen des amtlichen Katalogs
            </p>
            <a
              href="#anmelden"
              className="mt-10 rounded-tile border-2 border-surface px-6 py-3 font-mono text-sm tracking-wide uppercase transition hover:bg-surface hover:text-primary-dark"
            >
              Jetzt kostenlos anmelden
            </a>
            <ul className="mt-6 flex gap-3">
              {HERO_FEATURES.map(({ label, icon }) => (
                <li
                  key={label}
                  title={label}
                  className="flex h-9 w-9 items-center justify-center rounded-tile border border-surface-alt text-surface-alt"
                >
                  {icon}
                  <span className="sr-only">{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </HeroBand>

        <section className={`${CONTENT} py-16`}>
          <h2 className="sr-only">So funktioniert&apos;s</h2>
          <Columns>
            {[
              [
                'Originalfragen üben',
                'Alle Fragen aus dem amtlichen SKS-Fragenkatalog – wahlweise für „Segeln und Motor" oder nur „Motor", genau wie in der echten Prüfung.',
              ],
              [
                'Antworten oder sprechen',
                'Tippe deine Antwort in eigenen Worten oder sprich sie ein – die Spracherkennung läuft direkt im Browser.',
              ],
              [
                'Sofort Feedback bekommen',
                'Eine KI bewertet deine Antwort gegen die amtliche Musterantwort und zeigt dir, was gefehlt hat.',
              ],
            ].map(([title, text]) => (
              <div key={title} className="flex flex-col gap-6">
                <h3 className="font-serif text-2xl leading-snug text-primary">{title}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{text}</p>
              </div>
            ))}
          </Columns>
        </section>

        <section className="bg-primary py-16 text-surface">
          <div className={CONTENT}>
            <h2 className="sr-only">Warum SKS Lotse?</h2>
            <Columns>
              {[
                ['Freitext', 'So wie in der echten Prüfung – kein Rätselraten zwischen vorgegebenen Antworten.'],
                ['Ohne App', 'Läuft direkt im Browser, auf Handy, Tablet oder Desktop – kein Store-Download.'],
                ['Offener Katalog', 'Der amtliche Fragenkatalog und die Musterantworten stehen von Anfang an offen.'],
              ].map(([title, text]) => (
                <div key={title} className="flex flex-col gap-6">
                  <h3 className="font-serif text-2xl">{title}</h3>
                  <p className="text-sm leading-relaxed text-surface-alt">{text}</p>
                </div>
              ))}
            </Columns>
          </div>
        </section>

        <section className="bg-primary-dark py-14 text-surface">
          <div className={CONTENT}>
            <h2 className="font-serif text-3xl">Kostenlos starten</h2>
            <p className="mt-3 max-w-xl text-sm text-surface-alt">
              Zwei unabhängige Erweiterungen lassen sich später einzeln freischalten – Preise folgen in Kürze.
            </p>
          </div>
        </section>

        <section className={`${CONTENT} py-16`}>
          <Columns>
            {PLANS.map(({ kicker, title, icon, text, ad }) => (
              <div key={title} className="flex flex-col gap-4">
                <div className="relative flex h-40 items-center justify-center overflow-hidden bg-surface-alt text-primary">
                  <ContourBackground className="h-full" />
                  <div className="relative">{icon}</div>
                </div>
                <span className="mt-2 font-mono text-xs tracking-wide text-ink-soft uppercase">{kicker}</span>
                <h3 className="font-serif text-2xl text-primary">{title}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{text}</p>
                {ad ? <AdSlot /> : null}
              </div>
            ))}
          </Columns>
        </section>

        <section id="anmelden" className="scroll-mt-4 bg-primary py-16 text-surface">
          <div className={`${CONTENT} grid gap-10 sm:grid-cols-2`}>
            <div className="flex flex-col gap-4">
              <h2 className="font-serif text-3xl">Jetzt loslegen</h2>
              <dl className="flex flex-col gap-3 text-sm text-surface-alt">
                {[
                  ['Anmeldung', 'per E-Mail-Code, ohne Passwort'],
                  ['Fortschritt', 'wird in deinem Konto gespeichert'],
                  ['Kosten', 'kostenlos, Erweiterungen optional'],
                ].map(([term, detail]) => (
                  <div key={term}>
                    <dt className="inline text-surface">{term}: </dt>
                    <dd className="inline">{detail}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <LoginForm tone="dark" />
          </div>
        </section>
      </main>

      <LegalFooter />
    </div>
  )
}
