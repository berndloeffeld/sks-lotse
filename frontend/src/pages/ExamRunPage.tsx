import { useParams } from 'react-router-dom'

import { ExamGrading } from '../components/ExamGrading'
import { ExamResultView } from '../components/ExamResultView'
import { ExamWriting } from '../components/ExamWriting'
import { PageLayout } from '../components/PageLayout'
import { useExam } from '../hooks/useExam'

// One exam, shown according to its status: answering, self-assessment, or the
// finished result (which is also how an old exam is opened from the history).
export function ExamRunPage() {
  const { id } = useParams()
  const { exam, setExam, reload, isLoading, error } = useExam(id)

  const title =
    exam?.status === 'in_progress' ? 'Prüfung' : exam?.status === 'grading' ? 'Selbsteinschätzung' : 'Prüfungsergebnis'

  return (
    <PageLayout title={title} backTo="/exam" compact>
      {isLoading ? <p className="text-ink-soft">Prüfung wird geladen…</p> : null}
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
      {exam?.status === 'in_progress' ? (
        // Keyed on the id, so a new exam never inherits another's answer state.
        <ExamWriting key={exam.id} exam={exam} onChange={(next) => (next ? setExam(next) : void reload())} />
      ) : null}
      {exam?.status === 'grading' ? <ExamGrading key={exam.id} exam={exam} onChange={setExam} /> : null}
      {exam?.status === 'completed' ? <ExamResultView exam={exam} /> : null}
    </PageLayout>
  )
}
