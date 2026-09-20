import { useState } from 'react'

import { trackEvent } from '../analytics'
import { apiClient } from '../api/client'
import { formStyles } from './formStyles'

// Mirrors REPORT_CATEGORIES in backend/app/schemas/question_report.py.
const CATEGORIES = {
  question_text: 'Fragetext ist falsch',
  answer_text: 'Antwort ist falsch oder unvollständig',
  typo: 'Tippfehler / Darstellungsfehler',
  missing_image: 'Bild oder Skizze fehlt',
  other: 'Sonstiges',
}

type Category = keyof typeof CATEGORIES

const styles = formStyles('light')

// "Frage melden": a small, collapsed-by-default form under a question (ADR-0030).
// Keyed by question in the parent, so a new question always starts collapsed.
export function ReportQuestion({ questionId }: { questionId: number }) {
  const [isOpen, setIsOpen] = useState(false)
  const [category, setCategory] = useState<Category>('answer_text')
  const [comment, setComment] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isSent) {
    return (
      <p role="status" className="text-sm text-ink-soft">
        Danke für deine Meldung!
      </p>
    )
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="self-start font-mono text-xs tracking-wide text-ink-soft uppercase underline hover:text-ink"
      >
        Fehler in dieser Frage melden
      </button>
    )
  }

  async function send() {
    setIsSending(true)
    setError(null)
    try {
      await apiClient.post(`/questions/${questionId}/report`, { category, comment })
      trackEvent('question_reported', { category })
      setIsSent(true)
    } catch {
      setError('Die Meldung konnte nicht gesendet werden. Bitte versuche es später erneut.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-tile border border-border p-4"
      onSubmit={(event) => {
        event.preventDefault()
        void send()
      }}
    >
      <label className={styles.label}>
        Was ist das Problem?
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as Category)}
          className={styles.input}
        >
          {(Object.keys(CATEGORIES) as Category[]).map((key) => (
            <option key={key} value={key}>
              {CATEGORIES[key]}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.label}>
        Anmerkung (optional)
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={1000}
          rows={3}
          className={styles.input}
        />
      </label>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={styles.button} disabled={isSending}>
          {isSending ? 'Wird gesendet…' : 'Meldung senden'}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="px-2 font-mono text-xs tracking-wide text-ink-soft uppercase underline"
        >
          Abbrechen
        </button>
      </div>
    </form>
  )
}
