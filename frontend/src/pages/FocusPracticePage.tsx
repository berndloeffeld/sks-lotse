import { PageLayout } from '../components/PageLayout'
import { PracticeRun, type RunExit } from '../components/PracticeRun'
import { usePracticeSession } from '../hooks/usePracticeSession'
import { ErrorMessage } from '../components/Messages'

const EXIT: RunExit = { to: '/learn?modus=focus', label: 'Zum Fokus' }

// The Fokus session: the open questions of all Fokus topics, oldest correct
// answer first regardless of topic (ADR-0028). The server orders and filters;
// the list is fetched once, so the run stays as it was when it started.
export function FocusPracticePage() {
  const { data, isLoading, failed, reload, onGraded, contextLabel } = usePracticeSession(
    'focus-session',
    '/progress/focus/questions',
    'focus_session_start',
  )

  return (
    <PageLayout
      title="Fokus-Lernen"
      subtitle="Alle Fokus-Themen, die älteste richtige Antwort zuerst"
      compact
      immersive
    >
      {isLoading ? (
        <p className="text-sm text-ink-soft">Fragen werden geladen…</p>
      ) : failed || !data ? (
        <ErrorMessage onRetry={reload}>Die Fragen konnten nicht geladen werden.</ErrorMessage>
      ) : (
        <PracticeRun
          questions={data.questions}
          standings={data.standings}
          onGraded={onGraded}
          keepOrder
          contextLabel={contextLabel}
          exit={EXIT}
        />
      )}
    </PageLayout>
  )
}
