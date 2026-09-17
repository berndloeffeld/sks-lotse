import { Link } from 'react-router-dom'

import { AdSlot } from '../components/AdSlot'
import { ChartTile } from '../components/ChartTile'
import { ContourBackground } from '../components/ContourBackground'
import { Header } from '../components/Header'
import { AnswerIcon, CatalogIcon, FeedbackIcon } from '../components/icons/FeatureIcons'
import { LegalFooter } from '../components/LegalFooter'

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <Header />

      <main className="flex-1">
        <section className="relative px-4 py-16 text-center">
          <ContourBackground className="h-72" />
          <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6">
            <h1 className="font-serif text-4xl text-ink">Sicher durch die SKS-Theorieprüfung</h1>
            <p className="text-ink-soft">
              Übe mit den Originalfragen des amtlichen SKS-Fragenkatalogs und erhalte KI-Feedback zu deinen Antworten –
              gezielt für den Sportküstenschifferschein.
            </p>
            <Link
              to="/login"
              className="border border-ink bg-ink px-6 py-3 font-mono text-sm tracking-wide text-surface uppercase transition hover:border-primary-dark hover:bg-primary-dark"
            >
              Jetzt kostenlos anmelden
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-12">
          <h2 className="text-center font-serif text-2xl text-ink">So funktioniert's</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <ChartTile
              icon={<CatalogIcon className="h-8 w-8" />}
              title="Originalfragen üben"
              description="Fragen aus dem amtlichen SKS-Fragenkatalog – genau wie in der echten Prüfung."
            />
            <ChartTile
              icon={<AnswerIcon className="h-8 w-8" />}
              title="Antworten oder sprechen"
              description="Tippe deine Antwort oder sprich sie ein – die Spracherkennung läuft direkt im Browser."
            />
            <ChartTile
              icon={<FeedbackIcon className="h-8 w-8" />}
              title="Sofort Feedback bekommen"
              description="Eine KI bewertet deine Antwort gegen die amtliche Musterantwort und zeigt, was gefehlt hat."
            />
          </div>
        </section>

        <section className="mx-auto max-w-2xl px-4 py-12">
          <h2 className="text-center font-serif text-2xl text-ink">Warum SKS Lotse?</h2>
          <ul className="mt-8 flex flex-col">
            {[
              [
                'Freitext statt Multiple Choice',
                'So wie in der echten Prüfung – kein Rätselraten zwischen vorgegebenen Antworten.',
              ],
              [
                'Web-basiert, ohne App',
                'Läuft direkt im Browser, auf Handy, Tablet oder Desktop – kein Store-Download.',
              ],
              ['Kostenlos starten', 'Der amtliche Fragenkatalog und die Musterantworten stehen von Anfang an offen.'],
            ].map(([title, description]) => (
              <li key={title} className="flex flex-col gap-1 border-b border-border py-4">
                <span className="font-mono text-sm text-ink uppercase">{title}</span>
                <span className="text-sm text-ink-soft">{description}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-12">
          <h2 className="text-center font-serif text-2xl text-ink">Kostenlos starten</h2>
          <p className="mx-auto mt-2 max-w-md text-center text-sm text-ink-soft">
            Zwei unabhängige Erweiterungen lassen sich später einzeln freischalten – Preise folgen in Kürze.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-4 rounded-tile border border-ink bg-surface p-5">
              <h3 className="font-serif text-lg text-ink">Standard</h3>
              <p className="text-sm text-ink-soft">
                Fragen üben und die amtliche Musterantwort direkt zum Vergleich sehen – mit Werbung finanziert.
              </p>
              <AdSlot />
            </div>
            <div className="flex flex-col gap-4 rounded-tile border border-ink bg-surface p-5">
              <h3 className="font-serif text-lg text-ink">Erweiterungen</h3>
              <ul className="flex flex-col gap-3 text-sm">
                <li className="flex flex-col">
                  <span className="font-mono text-ink uppercase">KI-Bewertung</span>
                  <span className="text-ink-soft">
                    Schreib oder sprich deine Antwort und erhalte eine Bewertung mit Erklärung.
                  </span>
                </li>
                <li className="flex flex-col">
                  <span className="font-mono text-ink uppercase">Werbefrei</span>
                  <span className="text-ink-soft">Lernen ganz ohne Anzeigen.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="px-4 py-12 text-center">
          <Link
            to="/login"
            className="border border-ink bg-ink px-6 py-3 font-mono text-sm tracking-wide text-surface uppercase transition hover:border-primary-dark hover:bg-primary-dark"
          >
            Jetzt kostenlos anmelden
          </Link>
        </section>
      </main>

      <LegalFooter />
    </div>
  )
}
