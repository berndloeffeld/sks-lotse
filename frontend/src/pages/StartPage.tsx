import { Link } from 'react-router-dom'

import { getDisplayName } from '../api/types'
import { ChartTile } from '../components/ChartTile'
import { PageLayout } from '../components/PageLayout'
import { useAuthStore } from '../store/authStore'

const ICON = 'h-12 w-12'

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M4 5q4-1.5 8 1 4-2.5 8-1v13q-4-1.5-8 1-4-2.5-8-1zM12 6v13" strokeLinejoin="round" />
    </svg>
  )
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M6 5h12v16H6zM9 3h6v4H9zM9 12h6M9 16h4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

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
      <div className="grid gap-6 pt-4 sm:grid-cols-2">
        <Link to="/learn" className="group block transition hover:-translate-y-0.5">
          <ChartTile
            size="lg"
            className="h-full transition group-hover:border-primary group-hover:shadow-md"
            icon={<BookIcon />}
            title="Lernen"
            description="Themen wählen, Fragen üben und deinen Lernstand ansehen."
            badge="Los geht's →"
          />
        </Link>
        <Link to="/exam" className="group block transition hover:-translate-y-0.5">
          <ChartTile
            size="lg"
            className="h-full transition group-hover:border-primary group-hover:shadow-md"
            icon={<ClipboardIcon />}
            title="Prüfungssimulation"
            description="Eine Prüfung unter realistischen Bedingungen durchspielen."
            badge="Los geht's →"
          />
        </Link>
      </div>
    </PageLayout>
  )
}
