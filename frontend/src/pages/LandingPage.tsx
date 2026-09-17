import { Link } from 'react-router-dom'

import { Header } from '../components/Header'
import { LegalFooter } from '../components/LegalFooter'

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
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
      </main>

      <LegalFooter />
    </div>
  )
}
