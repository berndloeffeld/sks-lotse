import { PageLayout } from '../components/PageLayout'
import { PracticeRun } from '../components/PracticeRun'
import { usePracticeSession } from '../hooks/usePracticeSession'

const EMPTY_STATE = {
  title: 'Nichts aufzufrischen',
  text: 'Gerade droht keine deiner sicher gelernten Fragen zu verblassen. Komm in ein paar Tagen wieder.',
}

// The Auffrischen session: a random sample of questions that were gelernt and have lapsed or
// are about to (ADR-0049). The server picks them; the list is fetched once, so the run stays as
// it was when it started.
export function RefreshPracticePage() {
  const { data, isLoading, failed, onGraded, contextLabel } = usePracticeSession(
    'refresh-session',
    '/progress/refresh/questions',
    'refresh_session_start',
  )

  return (
    <PageLayout
      title="Auffrischen"
      subtitle="Sicher gelernte Fragen, die möglicherweise verblasst sind oder bald verblassen könnten"
      compact
      immersive
    >
      {isLoading ? (
        <p className="text-sm text-ink-soft">Fragen werden geladen…</p>
      ) : failed || !data ? (
        <p className="text-sm text-danger">Die Fragen konnten nicht geladen werden.</p>
      ) : (
        <PracticeRun
          questions={data.questions}
          standings={data.standings}
          onGraded={onGraded}
          keepOrder
          keepLearned
          emptyState={EMPTY_STATE}
          contextLabel={contextLabel}
        />
      )}
    </PageLayout>
  )
}
