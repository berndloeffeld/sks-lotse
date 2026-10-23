import { Component, type ErrorInfo, type ReactNode } from 'react'

import { buttonClass } from './buttonStyles'

interface RenderErrorBoundaryProps {
  // The error page, in the site's own layout (ErrorBoundary for SKS Lotse, sbf/SbfApp for SBF Lotse).
  fallback: ReactNode
  children: ReactNode
}

interface RenderErrorBoundaryState {
  hasError: boolean
}

// Catches unexpected render errors anywhere below it and shows an error
// page in the regular layout instead of a blank white screen. Recovery is a
// full page load (reload, or back to /), which also resets any app state
// that may have caused the error. Must be a class component — React has no
// hook equivalent of getDerivedStateFromError/componentDidCatch.
export class RenderErrorBoundary extends Component<RenderErrorBoundaryProps, RenderErrorBoundaryState> {
  state: RenderErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): RenderErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unexpected render error', error, info.componentStack)
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

// What the error page says, and the two ways out.
export function ErrorPageBody({ text }: { text: string }) {
  return (
    <>
      <p className="text-ink-soft">{text}</p>
      <div className="flex flex-wrap gap-4">
        <button type="button" onClick={() => window.location.reload()} className={buttonClass('primary')}>
          Seite neu laden
        </button>
        <a href="/" className={buttonClass('secondary')}>
          Zur Startseite
        </a>
      </div>
    </>
  )
}
