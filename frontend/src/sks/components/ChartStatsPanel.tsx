import { Link } from 'react-router-dom'

import { apiClient } from '../api/client'
import type { ChartStats, ExamResult } from '../api/types'
import { formatDateTime, formatDayMonth, formatDecimal, formatPercentOf, percentOf } from '../format'
import { useApiQuery } from '../hooks/useApiQuery'
import { dayFromNumber, timeAxis } from '../chartTimeline'
import { CHART_ORAL_MIN_POINTS, CHART_PASS_MIN_POINTS } from '../chartVerdict'
import { EXAM_RESULT_LABELS } from '../labels'
import { ErrorMessage } from './Messages'
import { sectionHeading } from './headingStyles'

const RESULT_BARS: Record<ExamResult, string> = {
  bestanden: 'bg-success',
  muendliche_nachpruefung: 'bg-accent',
  nicht_bestanden: 'bg-danger',
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="font-serif text-3xl text-ink">{value}</dd>
    </div>
  )
}

// Where a tick's label sits: centred under its day, but kept inside the chart at either end.
function tickPlacement(fraction: number): string {
  if (fraction < 0.1) return 'translate-x-0'
  if (fraction > 0.9) return '-translate-x-full'
  return '-translate-x-1/2'
}

// The runs to scale in time: from the first run's day to today, one equal slot per day; runs of the
// same day share its slot side by side, so a day with two sheets shows two bars.
function RunTimeline({ stats }: { stats: ChartStats }) {
  const axis = timeAxis(stats.runs, (run) => run.completed_at, new Date())
  const lastTick = axis.ticks[axis.ticks.length - 1]
  const lines = [
    { points: CHART_PASS_MIN_POINTS, className: 'border-success' },
    { points: CHART_ORAL_MIN_POINTS, className: 'border-accent' },
  ]
  return (
    <section>
      <h3 className="text-sm text-ink-soft">Punkte je Durchlauf im Zeitverlauf</h3>
      <div className="mt-2 flex gap-2">
        <div className="relative h-28 w-6 shrink-0 font-mono text-xs text-ink-soft" aria-hidden="true">
          {[stats.max_points, ...lines.map((line) => line.points), 0].map((points) => (
            <span
              key={points}
              className="absolute right-0 translate-y-1/2 leading-none"
              style={{ bottom: `${percentOf(points, stats.max_points)}%` }}
            >
              {points}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-28 border-b border-border">
            <ol aria-label="Ergebnisse der Kartenaufgaben">
              {axis.slots.flatMap((slot) =>
                slot.runs.map((run, index) => (
                  <li
                    key={run.attempt_id}
                    className="absolute inset-y-0 flex justify-center px-px"
                    style={{
                      left: `${((slot.offset + index / slot.runs.length) / axis.dayCount) * 100}%`,
                      width: `${100 / axis.dayCount / slot.runs.length}%`,
                    }}
                  >
                    <Link
                      to={`/charts/attempts/${run.attempt_id}`}
                      title={`${formatDateTime(run.completed_at)}: Blatt ${run.exercise_number}, ${run.points} Punkte, ${EXAM_RESULT_LABELS[run.result]}`}
                      aria-label={`${formatDateTime(run.completed_at)}: Blatt ${run.exercise_number}, ${run.points} von ${stats.max_points} Punkten, ${EXAM_RESULT_LABELS[run.result]}`}
                      className="flex h-full w-full max-w-8 flex-col justify-end bg-surface-alt"
                    >
                      <span
                        className={`block ${RESULT_BARS[run.result]}`}
                        style={{ height: `${percentOf(run.points, stats.max_points)}%` }}
                      />
                    </Link>
                  </li>
                )),
              )}
            </ol>
            {lines.map((line) => (
              <span
                key={line.points}
                aria-hidden="true"
                className={`pointer-events-none absolute inset-x-0 border-t border-dashed ${line.className}`}
                style={{ bottom: `${percentOf(line.points, stats.max_points)}%` }}
              />
            ))}
          </div>
          <div className="relative mt-1 h-4 text-xs text-ink-soft" aria-hidden="true">
            {axis.ticks.map((tick) => {
              const fraction = (tick + 0.5) / axis.dayCount
              return (
                <span
                  key={tick}
                  className={`absolute whitespace-nowrap ${tickPlacement(fraction)}`}
                  style={{ left: `${fraction * 100}%` }}
                >
                  {tick === lastTick ? 'heute' : formatDayMonth(dayFromNumber(axis.firstDay + tick).toISOString())}
                </span>
              )
            })}
          </div>
        </div>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
        <li>
          <span className={`mr-1 inline-block size-2.5 ${RESULT_BARS.bestanden}`} aria-hidden="true" />
          {EXAM_RESULT_LABELS.bestanden} (ab {CHART_PASS_MIN_POINTS})
        </li>
        <li>
          <span className={`mr-1 inline-block size-2.5 ${RESULT_BARS.muendliche_nachpruefung}`} aria-hidden="true" />
          Mündliche Nachprüfung ({CHART_ORAL_MIN_POINTS}–{CHART_PASS_MIN_POINTS - 1})
        </li>
        <li>
          <span className={`mr-1 inline-block size-2.5 ${RESULT_BARS.nicht_bestanden}`} aria-hidden="true" />
          {EXAM_RESULT_LABELS.nicht_bestanden} (bis {CHART_ORAL_MIN_POINTS - 1})
        </li>
      </ul>
    </section>
  )
}

function SheetList({ stats }: { stats: ChartStats }) {
  return (
    <section>
      <h3 className="text-sm text-ink-soft">Nach Blatt</h3>
      <ul className="mt-2 flex flex-col">
        {stats.sheets.map((sheet) => (
          <li
            key={sheet.number}
            className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-border py-2 text-sm"
          >
            <span className="w-14 shrink-0 text-ink-soft">Blatt {sheet.number}</span>
            <span className="min-w-0 flex-1 truncate text-ink">{sheet.title}</span>
            {/* On a phone the figures take a line of their own, below the title. */}
            <span className="flex w-full items-center justify-end gap-3 sm:w-auto">
              {sheet.last_result !== null ? (
                <>
                  <span className="font-mono text-xs text-ink-soft">{sheet.completed_count}×</span>
                  <span className="text-ink">
                    letzte {sheet.last_points} · beste {sheet.best_points}
                  </span>
                  <span
                    className={`inline-block size-2.5 shrink-0 ${RESULT_BARS[sheet.last_result]}`}
                    title={EXAM_RESULT_LABELS[sheet.last_result]}
                    aria-label={EXAM_RESULT_LABELS[sheet.last_result]}
                    role="img"
                  />
                </>
              ) : (
                <Link to={`/charts/${sheet.number}`} className="text-ink-soft hover:text-primary hover:underline">
                  noch nicht gerechnet →
                </Link>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// The learner's completed Kartenaufgaben over time, for the profile.
export function ChartStatsPanel() {
  const query = useApiQuery('chart-stats', () => apiClient.get<ChartStats>('/chart-exercises/stats'))
  const stats = query.data ?? null
  const error = query.failed ? 'Die Statistik der Kartenaufgaben konnte nicht geladen werden.' : null

  return (
    <div className="flex flex-col gap-6">
      <h2 className={sectionHeading}>Statistik der Kartenaufgaben</h2>
      <ErrorMessage onRetry={query.reload}>{error}</ErrorMessage>
      {!stats && !error ? <p className="text-sm text-ink-soft">Wird geladen…</p> : null}
      {stats && stats.completed_count === 0 ? (
        <p className="text-ink-soft">Noch keine Kartenaufgabe abgeschlossen.</p>
      ) : null}
      {stats && stats.completed_count > 0 ? (
        <>
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Figure label="Durchläufe" value={String(stats.completed_count)} />
            <Figure
              label="Bestanden"
              value={`${stats.passed_count} (${formatPercentOf(stats.passed_count, stats.completed_count)})`}
            />
            <Figure label="Ø Punkte" value={`${formatDecimal(stats.average_points ?? 0)} / ${stats.max_points}`} />
            <Figure label="Beste Punktzahl" value={`${stats.best_points} / ${stats.max_points}`} />
          </dl>
          <RunTimeline stats={stats} />
          <SheetList stats={stats} />
        </>
      ) : null}
      <Link to="/charts" className="self-start font-mono text-xs tracking-wide text-primary uppercase hover:underline">
        Alle Kartenaufgaben ansehen →
      </Link>
    </div>
  )
}
