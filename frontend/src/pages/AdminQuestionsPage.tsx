import { useState, type FormEvent } from 'react'

import { apiClient } from '../api/client'
import type { Question } from '../api/types'
import { QuestionImages } from '../components/QuestionImages'
import { RichText } from '../components/RichText'
import { SUBJECT_LABELS } from '../labels'
import { useApiQuery } from '../hooks/useApiQuery'

interface Search {
  q: string
  subject: string
}

// Looks up question and official answer texts across the whole catalog (/admin/questions),
// e.g. for a "Frage melden" note. Read-only: the catalog wording is never changed here.
export function AdminQuestionsPage() {
  const [input, setInput] = useState<Search>({ q: '', subject: '' })
  const [search, setSearch] = useState<Search>({ q: '', subject: '' })
  const hasSearch = search.q !== '' || search.subject !== ''
  const query = useApiQuery(`admin-questions?q=${search.q}&subject=${search.subject}`, () => {
    // Nothing asked yet: don't load (and render) the whole catalog with its images.
    if (!hasSearch) return Promise.resolve(null)
    const params = new URLSearchParams({ q: search.q })
    if (search.subject) params.set('subject', search.subject)
    return apiClient.get<Question[]>(`/admin/questions?${params}`)
  })

  function handleSearch(event: FormEvent) {
    event.preventDefault()
    setSearch({ q: input.q.trim(), subject: input.subject })
  }

  const results = query.data

  return (
    <div className="flex flex-col gap-6">
      <form role="search" className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={handleSearch}>
        <label className="flex flex-1 flex-col gap-1 text-sm text-ink-soft" htmlFor="question-search">
          Text oder Nummer
          <input
            id="question-search"
            type="search"
            maxLength={200}
            value={input.q}
            onChange={(event) => setInput({ ...input, q: event.target.value })}
            className="border border-border bg-surface px-3 py-2 text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-soft" htmlFor="question-subject">
          Fach
          <select
            id="question-subject"
            value={input.subject}
            onChange={(event) => setInput({ ...input, subject: event.target.value })}
            className="border border-border bg-surface px-3 py-2 text-ink"
          >
            <option value="">Alle Fächer</option>
            {Object.entries(SUBJECT_LABELS).map(([subject, label]) => (
              <option key={subject} value={subject}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="border border-ink bg-ink px-4 py-2 font-mono text-sm tracking-wide text-surface uppercase"
        >
          Suchen
        </button>
      </form>

      {query.isLoading ? <p className="text-sm text-ink-soft">Lädt …</p> : null}
      {query.failed ? <p className="text-sm text-danger">Die Suche ist fehlgeschlagen.</p> : null}
      {results === null ? <p className="text-sm text-ink-soft">Suchbegriff eingeben oder ein Fach wählen.</p> : null}
      {results ? (
        <>
          <p className="text-sm text-ink-soft">{results.length === 1 ? '1 Frage' : `${results.length} Fragen`}</p>
          <ul className="flex flex-col gap-4">
            {results.map((question) => (
              <li key={question.id} className="flex flex-col gap-3 border border-border p-4">
                <p className="font-mono text-xs tracking-wide text-ink-soft uppercase">
                  {SUBJECT_LABELS[question.subject] ?? question.subject} · Nr. {question.number} · ID {question.id}
                  {question.topic ? ` · ${question.topic}` : ''}
                </p>
                <p className="text-ink">
                  <RichText text={question.question_text} />
                </p>
                <QuestionImages images={question.question_images} part="question" />
                <div className="border-t border-border pt-3 text-sm text-ink">
                  <p className="mb-1 font-mono text-xs tracking-wide text-ink-soft uppercase">Amtliche Antwort</p>
                  <p className="whitespace-pre-line">
                    <RichText text={question.answer_text} />
                  </p>
                </div>
                <QuestionImages images={question.answer_images} part="answer" />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}
