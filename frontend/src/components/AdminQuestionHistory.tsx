import { useState } from 'react'
import { Link } from 'react-router-dom'

import { apiClient } from '../api/client'
import type { AdminQuestionHistory as History } from '../api/types'
import { formatDateTime } from '../format'
import { useApiQuery } from '../hooks/useApiQuery'
import { OUTCOME_LABELS } from '../labels'
import { buttonClass } from './buttonStyles'
import { ErrorMessage } from './Messages'

// "2,5 Tage" — the half-life a grading produced. Admin-only: the learner UI never shows it (ADR-0024).
function formatHalfLife(days: number): string {
  const value = days.toLocaleString('de-DE', { maximumFractionDigits: 2 })
  return `${value} ${days === 1 ? 'Tag' : 'Tage'}`
}

function HistoryTable({ questionId }: { questionId: number }) {
  const query = useApiQuery(`admin-question-history-${questionId}`, () =>
    apiClient.get<History>(`/admin/questions/${questionId}/history`),
  )
  if (query.isLoading) return <p className="text-sm text-ink-soft">Lädt …</p>
  if (!query.data) return <ErrorMessage onRetry={query.reload}>Der Verlauf ließ sich nicht laden.</ErrorMessage>
  const { users } = query.data
  if (users.length === 0) return <p className="text-sm text-ink-soft">Noch von niemandem bewertet.</p>
  return <LearnerHistory users={users} />
}

// One learner's gradings at a time, picked from a list — stays readable however many learners
// graded the question. Preselected: the most recently graded one (the API's first).
function LearnerHistory({ users }: { users: History['users'] }) {
  const [selectedId, setSelectedId] = useState(users[0].user_id)
  const learner = users.find((u) => u.user_id === selectedId) ?? users[0]
  const selectId = `question-history-learner-${users[0].user_id}`
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-soft">{users.length === 1 ? '1 Nutzer' : `${users.length} Nutzer`}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-ink-soft" htmlFor={selectId}>
          Nutzer
          <select
            id={selectId}
            value={learner.user_id}
            onChange={(event) => setSelectedId(Number(event.target.value))}
            className="border border-border bg-surface px-3 py-2 text-base text-ink sm:text-sm"
          >
            {users.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.email}
              </option>
            ))}
          </select>
        </label>
        <Link to={`/admin/users/${learner.user_id}`} className="py-2 text-sm text-ink underline">
          Zum Konto
        </Link>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="font-mono text-xs tracking-wide text-ink-soft uppercase">
          <tr>
            <th className="py-1 pr-4 font-normal">Zeitpunkt</th>
            <th className="py-1 pr-4 font-normal">Bewertung</th>
            <th className="py-1 font-normal">Halbwertzeit danach</th>
          </tr>
        </thead>
        <tbody>
          {learner.gradings.map((grading, index) => (
            <tr key={index} className="border-t border-border">
              <td className="py-1 pr-4">{formatDateTime(grading.graded_at)}</td>
              <td className="py-1 pr-4">{OUTCOME_LABELS[grading.outcome]}</td>
              <td className="py-1">{formatHalfLife(grading.half_life_days)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Per question: who graded it when, how, and which half-life came of it (ADR-0051). Loaded only
// when opened, so a search result list doesn't fire one request per question.
export function AdminQuestionHistory({ questionId }: { questionId: number }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-border pt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={buttonClass('tertiary', { tone: 'admin' })}
      >
        {open ? 'Antwortverlauf ausblenden' : 'Antwortverlauf anzeigen'}
      </button>
      {open ? (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-xs text-ink-soft">Bewertungen werden erst seit Einführung dieser Ansicht aufgezeichnet.</p>
          <HistoryTable questionId={questionId} />
        </div>
      ) : null}
    </div>
  )
}
