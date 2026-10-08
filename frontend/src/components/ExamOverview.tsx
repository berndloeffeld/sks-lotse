import { Link } from 'react-router-dom'

import { trackEvent } from '../analytics'
import { ApiError, apiClient } from '../api/client'
import type { Exam, ExamSummary } from '../api/types'
import { formatDateTime } from '../format'
import { useApiQuery } from '../hooks/useApiQuery'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { useExamVariantUpdate } from '../hooks/useExamVariantUpdate'
import { EXAM_RESULT_LABELS } from '../labels'
import { useAuthStore } from '../store/authStore'
import { ExamVariantDropdown } from './ExamVariantDropdown'
import { useNavigateWhileMounted } from '../hooks/useNavigateWhileMounted'
import { ErrorMessage } from './Messages'
import { buttonClass } from './buttonStyles'

const STATUS_LABELS = {
  in_progress: 'Läuft',
  grading: 'Selbsteinschätzung offen',
  completed: 'Abgeschlossen',
}

// The Probeprüfung's entry: the rules, start/resume, and the history of earlier exams (each opens
// its full review). Its own page (ExamPage), or the fourth tab of /learn with the Kartenaufgaben.
export function ExamOverview() {
  const navigate = useNavigateWhileMounted()
  const user = useAuthStore((state) => state.user)
  const examsQuery = useApiQuery('exams', () => apiClient.get<ExamSummary[]>('/exams'))
  const exams = examsQuery.data ?? null
  const variantUpdate = useExamVariantUpdate()
  const startAction = useAsyncAction()
  const isStarting = startAction.isPending

  function start() {
    return startAction.run(
      async () => {
        const exam = await apiClient.post<Exam>('/exams')
        trackEvent('exam_started')
        navigate(`/exam/${exam.id}`)
      },
      (e) =>
        e instanceof ApiError && e.status === 409
          ? 'Es läuft bereits eine Prüfung. Setze sie unten fort.'
          : 'Die Prüfung konnte nicht gestartet werden.',
    )
  }

  const running = exams?.find((e) => e.status === 'in_progress')
  const hasVariant = Boolean(user?.exam_variant)

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <p className="text-ink">
          Eine zufällige Prüfung aus dem Fragenkatalog, wie im Fragebogen der echten Prüfung: 30 Fragen (9 Navigation, 7
          Schifffahrtsrecht, 5 Wetterkunde, 9 Seemannschaft) in maximal 90 Minuten, ohne Tipps.
        </p>
        <p className="text-sm text-ink-soft">
          Erst beantwortest du alle Fragen, danach schätzt du deine Antworten anhand der amtlichen Antworten selbst ein.
          Ab 39 von 60 Punkten ist der Fragebogen bestanden. Die Kartenaufgabe ist nicht enthalten. Als „Richtig“
          bewertete Fragen zählen nach der Auswertung für deinen Lernstand, teilweise richtige und falsche ändern ihn
          nicht.
        </p>
        {/* Without the list the exam can't start (a running one would have to be resumed instead), so
            the learner needs a way to ask again. */}
        <ErrorMessage onRetry={examsQuery.reload}>
          {examsQuery.failed ? 'Die Prüfungen konnten nicht geladen werden.' : null}
        </ErrorMessage>
        <ErrorMessage>{startAction.error}</ErrorMessage>
        {!hasVariant ? (
          // Picked right here the first time (the same setting as on /learn and /profile), so the
          // first exam doesn't start with a detour.
          <div className="flex flex-col gap-2">
            <p className="text-ink">Wähle zuerst, ob du die Prüfung für „Motor“ oder „Segeln und Motor“ ablegst.</p>
            <ExamVariantDropdown
              value={null}
              onChange={variantUpdate.changeVariant}
              disabled={variantUpdate.isSaving}
            />
            <ErrorMessage>{variantUpdate.error}</ErrorMessage>
          </div>
        ) : running ? (
          <Link to={`/exam/${running.id}`} className={`${buttonClass('primary')} self-start`}>
            Laufende Prüfung fortsetzen
          </Link>
        ) : (
          <button
            type="button"
            className={`${buttonClass('primary')} self-start`}
            disabled={isStarting || exams === null}
            onClick={() => void start()}
          >
            {isStarting ? 'Wird gestartet…' : 'Prüfung starten'}
          </button>
        )}
      </section>

      <section>
        <h2 className="font-serif text-2xl text-ink">Bisherige Prüfungen</h2>
        {exams === null && !examsQuery.failed ? <p className="mt-3 text-ink-soft">Wird geladen…</p> : null}
        {exams?.length === 0 ? <p className="mt-3 text-ink-soft">Noch keine Prüfung abgelegt.</p> : null}
        <ul className="mt-3 flex flex-col">
          {exams?.map((exam) => (
            <li key={exam.id} className="border-b border-border last:border-b-0">
              <Link
                to={`/exam/${exam.id}`}
                className="flex items-center justify-between gap-4 px-2 py-3 hover:bg-surface-alt"
              >
                <span className="text-ink">{formatDateTime(exam.started_at)}</span>
                <span className="text-right font-mono text-xs text-ink-soft">
                  {exam.status === 'completed' && exam.points !== null && exam.result
                    ? `${exam.points} / ${exam.max_points} · ${EXAM_RESULT_LABELS[exam.result]}`
                    : STATUS_LABELS[exam.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
