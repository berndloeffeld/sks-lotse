import type { ReactNode } from 'react'

import { PageLayout } from './PageLayout'
import { ErrorPageBody, RenderErrorBoundary } from './RenderErrorBoundary'

// SKS Lotse's error page (RenderErrorBoundary), in the regular layout.
export function ErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <RenderErrorBoundary
      fallback={
        <PageLayout title="Da ist etwas schiefgelaufen" nav="none">
          <ErrorPageBody text="Beim Anzeigen dieser Seite ist ein unerwarteter Fehler aufgetreten. Lade die Seite neu – bereits gespeicherter Lernfortschritt geht dabei nicht verloren." />
        </PageLayout>
      }
    >
      {children}
    </RenderErrorBoundary>
  )
}
