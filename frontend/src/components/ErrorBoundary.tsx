import { Component, type ErrorInfo, type ReactNode } from 'react'

import { PageLayout } from './PageLayout'

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
          Beim Anzeigen dieser Seite ist ein unerwarteter Fehler aufgetreten. Lade die Seite neu – dein Lernfortschritt
          ist im Konto gespeichert und geht nicht verloren.
        </p>
        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-tile bg-accent px-6 py-3 font-mono text-sm tracking-wide text-surface uppercase transition hover:bg-ink"
          >
            Seite neu laden
          </button>
          <a
            href="/"
            className="rounded-tile border-2 border-primary px-6 py-3 font-mono text-sm tracking-wide text-primary uppercase transition hover:bg-primary hover:text-surface"
          >
            Zur Startseite
          </a>
        </div>
      </PageLayout>
    )
  }
}
