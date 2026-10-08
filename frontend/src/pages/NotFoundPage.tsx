import { Link } from 'react-router-dom'

import { formStyles } from '../components/formStyles'
import { PageLayout } from '../components/PageLayout'
import { useAuthStore } from '../store/authStore'

interface NotFoundPageProps {
  // What isn't there, in one sentence.
  what: string
  // The overview the address most likely belonged to.
  backTo: string
  backLabel: string
}

// What an address that leads nowhere shows — a mistyped or outdated link, a topic or Kartenaufgabe
// that doesn't exist: said plainly, with the way to the overview it most likely meant.
export function NotFoundPage({ what, backTo, backLabel }: NotFoundPageProps) {
  return (
    <PageLayout title="Seite nicht gefunden" nav="public" compact>
      <p className="text-ink">{what} Vielleicht ist der Link veraltet oder vertippt.</p>
      <Link to={backTo} className={`${formStyles('light').button} self-start`}>
        {backLabel}
      </Link>
    </PageLayout>
  )
}

// Any address the app has no route for: back to where a guest or a learner starts.
export function UnknownPathPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  return (
    <NotFoundPage
      what="Unter dieser Adresse gibt es keine Seite."
      backTo={isAuthenticated ? '/learn' : '/'}
      backLabel={isAuthenticated ? 'Zum Lernen' : 'Zur Startseite'}
    />
  )
}
