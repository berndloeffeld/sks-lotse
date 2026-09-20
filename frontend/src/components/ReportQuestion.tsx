import { useEffect, useRef, useState } from 'react'

import { trackEvent } from '../analytics'
import { apiClient } from '../api/client'
import { FlagIcon } from './icons/FeatureIcons'
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

// "Frage melden" (ADR-0030): a flag in the question header that opens the form as a popover, so
// reporting never shifts the learning loop. Anchors to the nearest positioned ancestor (the header
// row); keyed by question in the parent, so a new question always starts closed.
export function ReportQuestion({ questionId }: { questionId: number }) {
  const [isOpen, setIsOpen] = useState(false)
  const [category, setCategory] = useState<Category>('answer_text')
  const [comment, setComment] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const firstFieldRef = useRef<HTMLSelectElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen) (firstFieldRef.current ?? closeRef.current)?.focus()
  }, [isOpen])

  function close() {
    setIsOpen(false)
    buttonRef.current?.focus()
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
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Fehler in dieser Frage melden"
        aria-expanded={isOpen}
        title="Fehler in dieser Frage melden"
        onClick={() => (isOpen ? close() : setIsOpen(true))}
        className={`rounded-tile p-1 hover:text-ink ${isSent ? 'text-primary' : 'text-ink-soft'}`}
      >
        <FlagIcon className="size-5" />
      </button>
      {isOpen ? (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape closes the dialog, standard dialog behavior
        <div
          role="dialog"
          aria-label="Fehler in dieser Frage melden"
          onKeyDown={(event) => {
            if (event.key === 'Escape') close()
          }}
          className="absolute top-full right-0 z-20 mt-2 w-[min(22rem,100%)] rounded-tile border border-ink bg-surface p-4 shadow-lg"
        >
          {isSent ? (
            <div className="flex flex-col gap-3">
              <p role="status" className="text-ink">
                Danke für deine Meldung!
              </p>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                className="self-start px-2 font-mono text-xs tracking-wide text-ink-soft uppercase underline"
              >
                Schließen
              </button>
            </div>
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                void send()
              }}
            >
              <label className={styles.label}>
                Was ist das Problem?
                <select
                  ref={firstFieldRef}
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
                  onClick={close}
                  className="px-2 font-mono text-xs tracking-wide text-ink-soft uppercase underline"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </>
  )
}
