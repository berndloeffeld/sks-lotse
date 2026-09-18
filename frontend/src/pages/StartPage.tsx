import { Link, useNavigate } from 'react-router-dom'

import { ChartTile } from '../components/ChartTile'
import { ContourBackground } from '../components/ContourBackground'
import { LegalFooter } from '../components/LegalFooter'
import { useAuthStore } from '../store/authStore'

export function StartPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-12">
      <header className="relative overflow-hidden py-4">
        <ContourBackground className="h-24" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-sm text-ink-soft">Angemeldet als</p>
            <p className="font-mono text-ink">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="border border-ink px-4 py-2 font-mono text-sm tracking-wide text-ink uppercase hover:bg-surface-alt"
          >
            Abmelden
          </button>
        </div>
      </header>

      {/* Prüfungssimulation stays non-interactive for now — exam simulation
          doesn't exist yet (no grading backend, see CLAUDE.md). */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/lernen" className="block">
          <ChartTile title="Lernen" description="Themen wählen & Lernstand ansehen" />
        </Link>
        <ChartTile title="Prüfungssimulation" description="Demnächst verfügbar" />
      </div>
      <LegalFooter />
    </main>
  )
}
