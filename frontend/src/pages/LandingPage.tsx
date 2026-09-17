import { Link } from 'react-router-dom'

export function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="font-serif text-4xl text-ink">SKS Lotse</h1>
      <p className="text-ink-soft">
        Bereite dich gezielt auf die theoretische Prüfung zum Sportküstenschifferschein vor.
      </p>
      <Link
        to="/login"
        className="border border-ink bg-ink px-6 py-3 font-mono text-sm tracking-wide text-surface uppercase transition hover:border-primary-dark hover:bg-primary-dark"
      >
        Anmelden
      </Link>
    </main>
  )
}
