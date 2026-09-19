import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { AdSlot } from '../components/AdSlot'
import { ContourBackground } from '../components/ContourBackground'
import { Header } from '../components/Header'
import { AnswerIcon, CatalogIcon, FeedbackIcon } from '../components/icons/FeatureIcons'
import { LegalFooter } from '../components/LegalFooter'

// Banded layout: full-width color bands (light bg / primary / primary-dark)
// alternating down the page, each holding a max-width content column, with
// a slanted bottom edge on the hero like a horizon line. Palette, type and
// square-cornered chrome stay per ADR-0014.

const CONTENT = 'mx-auto w-full max-w-4xl px-4'

function Columns({ children }: { children: ReactNode }) {
  return <div className="grid gap-8 sm:grid-cols-3">{children}</div>
}

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <Header />

      <main className="flex-1">
        <section
          className="relative bg-primary pt-16 pb-28 text-center text-surface sm:pb-36"
          style={{ clipPath: 'polygon(0 0, 100% 0, 100% 85%, 0 100%)' }}
        >
          <ContourBackground className="h-full" stroke="var(--color-surface-alt)" />
          <div className={`relative flex flex-col items-center gap-6 ${CONTENT} max-w-2xl`}>
            <h1 className="font-serif text-3xl tracking-wide break-words uppercase sm:text-4xl">
              Sicher durch die SKS-Theorieprüfung
            </h1>
            <p className="font-mono text-xs tracking-wide text-surface-alt uppercase sm:text-sm">
              Originalfragen · Freitext · KI-Feedback
            </p>
            <Link
              to="/login"
              className="rounded-tile border-2 border-surface px-6 py-3 font-mono text-sm tracking-wide uppercase transition hover:bg-surface hover:text-primary-dark"
            >
              Jetzt kostenlos anmelden
            </Link>
          </div>
        </section>

        <section className={`${CONTENT} py-12`}>
          <h2 className="sr-only">So funktioniert&apos;s</h2>
          <Columns>
            {[
              {
                icon: <CatalogIcon className="h-8 w-8" />,
                title: 'Originalfragen üben',
                text: 'Fragen aus dem amtlichen SKS-Fragenkatalog – genau wie in der echten Prüfung.',
              },
              {
                icon: <AnswerIcon className="h-8 w-8" />,
                title: 'Antworten oder sprechen',
                text: 'Tippe deine Antwort oder sprich sie ein – die Spracherkennung läuft direkt im Browser.',
              },
              {
                icon: <FeedbackIcon className="h-8 w-8" />,
                title: 'Sofort Feedback bekommen',
                text: 'Eine KI bewertet deine Antwort gegen die amtliche Musterantwort und zeigt, was gefehlt hat.',
              },
            ].map(({ icon, title, text }) => (
              <div key={title} className="flex flex-col gap-3">
                <div className="text-primary">{icon}</div>
                <h3 className="font-serif text-xl text-primary">{title}</h3>
                <p className="text-sm text-ink-soft">{text}</p>
              </div>
            ))}
          </Columns>
        </section>

        <section className="bg-primary py-12 text-surface">
          <div className={CONTENT}>
            <h2 className="sr-only">Warum SKS Lotse?</h2>
            <Columns>
              {[
                [
                  'Freitext statt Multiple Choice',
                  'So wie in der echten Prüfung – kein Rätselraten zwischen vorgegebenen Antworten.',
                ],
                [
                  'Web-basiert, ohne App',
                  'Läuft direkt im Browser, auf Handy, Tablet oder Desktop – kein Store-Download.',
                ],
                ['Offener Katalog', 'Der amtliche Fragenkatalog und die Musterantworten stehen von Anfang an offen.'],
              ].map(([title, text]) => (
                <div key={title} className="flex flex-col gap-2">
                  <h3 className="font-serif text-lg">{title}</h3>
                  <p className="text-sm text-surface-alt">{text}</p>
                </div>
              ))}
            </Columns>
          </div>
        </section>

        <section className={`${CONTENT} py-12`}>
          <h2 className="text-center font-serif text-2xl text-ink">Kostenlos starten</h2>
          <p className="mx-auto mt-2 max-w-md text-center text-sm text-ink-soft">
            Zwei unabhängige Erweiterungen lassen sich später einzeln freischalten – Preise folgen in Kürze.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-3 rounded-tile border border-ink bg-surface p-5">
              <span className="font-mono text-xs tracking-wide text-ink-soft uppercase">Standard</span>
              <h3 className="font-serif text-lg text-ink">Musterantwort vergleichen</h3>
              <p className="text-sm text-ink-soft">
                Fragen üben und die amtliche Musterantwort direkt zum Vergleich sehen – mit Werbung finanziert.
              </p>
              <AdSlot />
            </div>
            <div className="flex flex-col gap-3 rounded-tile border border-accent bg-surface p-5">
              <span className="font-mono text-xs tracking-wide text-accent uppercase">Erweiterung</span>
              <h3 className="font-serif text-lg text-ink">KI-Bewertung</h3>
              <p className="text-sm text-ink-soft">
                Schreib oder sprich deine Antwort und erhalte eine Bewertung mit Erklärung.
              </p>
            </div>
            <div className="flex flex-col gap-3 rounded-tile border border-ink bg-surface p-5">
              <span className="font-mono text-xs tracking-wide text-ink-soft uppercase">Erweiterung</span>
              <h3 className="font-serif text-lg text-ink">Werbefrei</h3>
              <p className="text-sm text-ink-soft">Lernen ganz ohne Anzeigen.</p>
            </div>
          </div>
        </section>

        <section className="bg-primary py-12 text-surface">
          <div className={`${CONTENT} grid items-center gap-6 sm:grid-cols-2`}>
            <div className="flex flex-col gap-3">
              <h2 className="font-serif text-2xl">Jetzt loslegen</h2>
              <p className="text-sm text-surface-alt">
                Anmeldung per E-Mail-Code, ganz ohne Passwort. Dein Lernfortschritt wird in deinem Konto gespeichert.
              </p>
            </div>
            <Link
              to="/login"
              className="rounded-tile bg-accent px-6 py-3 text-center font-mono text-sm tracking-wide text-surface uppercase transition hover:bg-ink"
            >
              Jetzt kostenlos anmelden
            </Link>
          </div>
        </section>
      </main>

      <LegalFooter tone="dark" />
    </div>
  )
}
