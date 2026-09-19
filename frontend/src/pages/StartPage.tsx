import { Link } from 'react-router-dom'

import { getDisplayName } from '../api/types'
import { ChartTile } from '../components/ChartTile'
import { PageLayout } from '../components/PageLayout'
import { useAuthStore } from '../store/authStore'

export function StartPage() {
  const user = useAuthStore((state) => state.user)

  return (
    <PageLayout
      title="Übersicht"
      subtitle={
        <>
          Angemeldet als{' '}
          <Link to="/profile" className="font-mono text-surface hover:underline">
            {user ? getDisplayName(user) : ''}
          </Link>
        </>
      }
    >
      {/* Prüfungssimulation stays non-interactive for now — exam simulation
          doesn't exist yet (no grading backend, see CLAUDE.md). */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/learn" className="block">
          <ChartTile title="Lernen" description="Themen wählen & Lernstand ansehen" />
        </Link>
        <ChartTile title="Prüfungssimulation" description="Demnächst verfügbar" />
      </div>
    </PageLayout>
  )
}
