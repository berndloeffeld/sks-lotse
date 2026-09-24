import { Link } from 'react-router-dom'

import { apiClient } from '../api/client'
import type { ExamStats } from '../api/types'
import { formatDateTime, percentOf } from '../format'
import { useApiQuery } from '../hooks/useApiQuery'
import { EXAM_RESULT_LABELS, SUBJECT_GROUP_LABELS } from '../labels'

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="font-serif text-3xl text-ink">{value}</dd>
    </div>
  )
}

// Statistics over the learner's completed exams, for the profile.
export function ExamStatsPanel() {
  const query = useApiQuery('exam-stats', () => apiClient.get<ExamStats>('/exams/stats'))
  const stats = query.data ?? null
  const error = query.failed ? 'Die Prüfungsstatistik konnte nicht geladen werden.' : null

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-serif text-3xl text-ink">Prüfungsstatistik</h2>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {!stats && !error ? <p className="text-sm text-ink-soft">Wird geladen…</p> : null}
      {stats && stats.completed_count === 0 ? <p className="text-ink-soft">Noch keine Prüfung abgeschlossen.</p> : null}
      {stats && stats.completed_count > 0 ? (
        <>
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Figure label="Prüfungen" value={String(stats.completed_count)} />
            <Figure
              label="Bestanden"
              value={`${stats.passed_count} (${percentOf(stats.passed_count, stats.completed_count)} %)`}
            />
            <Figure
              label="Ø Punkte"
              value={`${String(stats.average_points).replace('.', ',')} / ${stats.max_points}`}
            />
            <Figure label="Beste Punktzahl" value={`${stats.best_points} / ${stats.max_points}`} />
          </dl>

          <section>
            <h3 className="text-sm text-ink-soft">Letzte Ergebnisse (älteste zuerst)</h3>
            <ol className="mt-2 flex items-end gap-2" aria-label="Letzte Prüfungsergebnisse">
              {stats.recent.map((point) => (
                <li key={point.exam_id} className="flex-1">
                  <Link
                    to={`/exam/${point.exam_id}`}
                    title={`${formatDateTime(point.submitted_at)}: ${point.points} Punkte, ${EXAM_RESULT_LABELS[point.result]}`}
                    aria-label={`${formatDateTime(point.submitted_at)}: ${point.points} von ${stats.max_points} Punkten`}
                    className="flex h-24 flex-col justify-end bg-surface-alt"
                  >
                    <span
                      className={`block ${point.result === 'bestanden' ? 'bg-success' : 'bg-primary'}`}
                      style={{ height: `${percentOf(point.points, stats.max_points)}%` }}
                    />
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h3 className="text-sm text-ink-soft">Erreichte Punkte nach Fach</h3>
            <ul className="mt-2 flex flex-col gap-2">
              {stats.group_scores.map((g) => (
                <li key={g.subject_group} className="flex items-center gap-3">
                  <span className="w-40 text-ink">{SUBJECT_GROUP_LABELS[g.subject_group]}</span>
                  <span className="flex h-2 flex-1 bg-surface-alt" aria-hidden="true">
                    <span className="h-full bg-success" style={{ width: `${percentOf(g.points, g.max_points)}%` }} />
                  </span>
                  <span className="w-12 text-right font-mono text-sm text-ink-soft">
                    {percentOf(g.points, g.max_points)} %
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
      <Link to="/exam" className="self-start font-mono text-xs tracking-wide text-primary uppercase hover:underline">
        Alle Prüfungen ansehen →
      </Link>
    </div>
  )
}
