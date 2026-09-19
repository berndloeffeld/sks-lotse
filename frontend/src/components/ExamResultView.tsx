import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { apiClient } from '../api/client'
import type { Exam } from '../api/types'
import { formatDateTime, percentOf } from '../format'
import { EXAM_RESULT_LABELS, OUTCOME_LABELS, SUBJECT_GROUP_LABELS, VARIANT_LABELS } from '../labels'
import type { ExamVariant } from '../api/types'
import { formStyles } from './formStyles'
import { RichText } from './RichText'

const styles = formStyles('light')

// The finished exam: points, result, per-subject score and every question
// with the learner's own answer, the official one and the self-assessment.
// Also what an old exam looks like when opened from the history.
export function ExamResultView({ exam }: { exam: Exam }) {
  const navigate = useNavigate()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function remove() {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await apiClient.delete(`/exams/${exam.id}`)
      navigate('/exam')
    } catch {
      setDeleteError('Die Prüfung konnte nicht gelöscht werden.')
      setIsDeleting(false)
    }
  }

  const passed = exam.result === 'bestanden'

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-tile border border-ink bg-surface p-6">
        <p className="font-mono text-xs tracking-wide text-ink-soft uppercase">
          {formatDateTime(exam.started_at)} · {VARIANT_LABELS[exam.exam_variant as ExamVariant] ?? exam.exam_variant}
          {exam.timed_out ? ' · Zeit abgelaufen' : ''}
        </p>
        <p className="mt-2 font-serif text-4xl text-ink">
          {exam.points} <span className="text-2xl text-ink-soft">von {exam.max_points} Punkten</span>
        </p>
        <p className={`mt-1 text-lg ${passed ? 'text-success' : 'text-ink'}`}>
          {exam.result ? EXAM_RESULT_LABELS[exam.result] : ''}
        </p>
        <p className="mt-3 text-sm text-ink-soft">
          Gewertet wird nur der Fragebogen (ab 39 Punkten bestanden, 33–38 mündliche Nachprüfung). Die Kartenaufgabe der
          echten Prüfung ist nicht Teil der Simulation. Die Punkte beruhen auf deiner Selbsteinschätzung (Richtig 2,
          Teilweise Richtig 1, Falsch 0).
        </p>
      </section>

      {exam.group_scores ? (
        <section>
          <h2 className="font-serif text-2xl text-ink">Nach Fach</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {exam.group_scores.map((g) => (
              <li key={g.subject_group} className="flex items-center gap-3">
                <span className="w-40 text-ink">{SUBJECT_GROUP_LABELS[g.subject_group]}</span>
                <span className="flex h-2 flex-1 bg-surface-alt" aria-hidden="true">
                  <span className="h-full bg-success" style={{ width: `${percentOf(g.points, g.max_points)}%` }} />
                </span>
                <span className="w-16 text-right font-mono text-sm text-ink-soft">
                  {g.points} / {g.max_points}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="font-serif text-2xl text-ink">Alle Fragen</h2>
        <div className="mt-3 flex flex-col">
          {exam.questions.map((q) => (
            <details key={q.position} className="border-b border-border py-3">
              <summary className="cursor-pointer text-ink">
                <span className="font-mono text-xs text-ink-soft">{q.position}.</span>{' '}
                {q.question_text ? <RichText text={q.question_text} /> : 'Frage nicht mehr im Katalog'}
                <span className="ml-2 font-mono text-xs text-ink-soft">
                  {q.outcome ? `${OUTCOME_LABELS[q.outcome]} · ${q.points} P.` : ''}
                </span>
              </summary>
              <div className="mt-3 flex flex-col gap-3 pl-4">
                <div>
                  <h3 className="text-sm text-ink-soft">Deine Antwort</h3>
                  {q.answer_text?.trim() ? (
                    <p className="whitespace-pre-line text-ink">{q.answer_text}</p>
                  ) : (
                    <p className="text-ink-soft italic">Nicht beantwortet.</p>
                  )}
                </div>
                <div>
                  <h3 className="text-sm text-ink-soft">Amtliche Antwort</h3>
                  <p className="whitespace-pre-line text-ink">
                    {q.official_answer ? <RichText text={q.official_answer} /> : '—'}
                  </p>
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/exam" className={styles.button}>
            Zur Prüfungsübersicht
          </Link>
          {confirmingDelete ? (
            <>
              <button type="button" className={styles.button} disabled={isDeleting} onClick={() => void remove()}>
                {isDeleting ? 'Wird gelöscht…' : 'Endgültig löschen'}
              </button>
              <button type="button" className={styles.link} onClick={() => setConfirmingDelete(false)}>
                Abbrechen
              </button>
            </>
          ) : (
            <button type="button" className={styles.link} onClick={() => setConfirmingDelete(true)}>
              Diese Prüfung löschen
            </button>
          )}
        </div>
        {deleteError ? (
          <p role="alert" className={styles.error}>
            {deleteError}
          </p>
        ) : null}
      </section>
    </div>
  )
}
