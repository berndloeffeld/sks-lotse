import { Component, type ErrorInfo, type ReactNode } from 'react'

import { PageLayout } from './PageLayout'
import { buttonClass } from './buttonStyles'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

// Catches unexpected render errors anywhere below it and shows an error
// page in the regular layout instead of a blank white screen. Recovery is a
// full page load (reload, or back to /), which also resets any app state
// that may have caused the error. Must be a class component — React has no
// hook equivalent of getDerivedStateFromError/componentDidCatch.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unexpected render error', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <PageLayout title="Da ist etwas schiefgelaufen" nav="none">
        <p className="text-ink-soft">
          Beim Anzeigen dieser Seite ist ein unerwarteter Fehler aufgetreten. Lade die Seite neu – bereits gespeicherter
          Lernfortschritt geht dabei nicht verloren.
        </p>
        <div className="flex flex-wrap gap-4">
          <button type="button" onClick={() => window.location.reload()} className={buttonClass('primary')}>
            Seite neu laden
          </button>
          <a href="/" className={buttonClass('secondary')}>
            Zur Startseite
          </a>
        </div>
      </PageLayout>
    )
  }
}
