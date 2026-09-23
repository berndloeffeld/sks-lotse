import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

import type { GradingOutcome } from '../api/types'
import { OUTCOME_LABELS } from '../labels'
import { scrollBelowIntoView } from '../scroll'
import { AiAnswerCheck } from './AiAnswerCheck'
import { formStyles } from './formStyles'

const OUTCOMES = Object.keys(OUTCOME_LABELS) as GradingOutcome[]
const styles = formStyles('light')

interface SelfAssessmentProps {
  // Radio group name, unique per page.
  name: string
  // Saves the chosen grade; rejects when that failed (then `saveErrorMessage` is shown).
  onSave: (outcome: GradingOutcome) => Promise<void>
  saveErrorMessage: string
  // The Lotsen-Check row (ADR-0031), when the question has a text answer to check against.
  aiCheck: { questionId: number; answer: string } | null
  // Practice lays the radios out in a row under the answers, the exam as a column.
  layout: 'row' | 'column'
}

// Richtig / Teilweise Richtig / Falsch for one question, then "Weiter" — shared by practice and
// the exam's self-assessment (ADR-0023/0029). Rendered once per question (the parent keys it), so
// each question starts unselected.
//
// Keyboard: on mount focus goes to the group *before* the options, so Tab lands on "Richtig" and
// keeps cycling through the radios and the Lotse button without selecting anything; Enter on an
// option saves it. The view scrolls until "Weiter" clears the fold, since the answers above can
// already fill a short viewport.
export function SelfAssessment({ name, onSave, saveErrorMessage, aiCheck, layout }: SelfAssessmentProps) {
  const [outcome, setOutcome] = useState<GradingOutcome | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const groupRef = useRef<HTMLFieldSetElement>(null)
  const askRef = useRef<HTMLButtonElement>(null)
  const radioRefs = useRef<(HTMLInputElement | null)[]>([])
  const continueRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    scrollBelowIntoView(continueRef.current)
    groupRef.current?.focus({ preventScroll: true })
  }, [])

  // Tab cycles through the grade radios and, when usable, the Lotse button (focus only, no selection).
  function cycleFocus(from: HTMLElement, backwards: boolean) {
    const stops = [...radioRefs.current, askRef.current].filter(
      (el): el is HTMLInputElement | HTMLButtonElement => el !== null && !el.disabled,
    )
    const at = stops.indexOf(from as HTMLInputElement | HTMLButtonElement)
    stops[(at + (backwards ? stops.length - 1 : 1)) % stops.length]?.focus()
  }

  // The AI check only *suggests*: preselect its grade and put focus on it, so Enter confirms
  // and Tab keeps cycling through the radios like in the manual loop. Its suggestion box can
  // push "Weiter" further down than the first scroll reached, so scroll again.
  function suggestOutcome(suggested: GradingOutcome) {
    flushSync(() => setOutcome(suggested))
    radioRefs.current[OUTCOMES.indexOf(suggested)]?.focus({ preventScroll: true })
    scrollBelowIntoView(continueRef.current)
  }

  // `chosen` lets Enter on a radio save the grade it just selected, before state has caught up.
  async function save(chosen: GradingOutcome | null) {
    if (!chosen || isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      await onSave(chosen)
    } catch {
      setError(saveErrorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  const row = layout === 'row'
  return (
    <>
      <fieldset
        ref={groupRef}
        tabIndex={-1}
        className={
          row ? 'flex flex-wrap items-center gap-x-5 gap-y-1 outline-none' : 'flex flex-col gap-2 outline-none'
        }
        disabled={isSaving}
      >
        <legend className={row ? 'mb-1 text-sm text-ink-soft' : 'mb-2 text-sm text-ink-soft'}>
          Wie gut war deine Antwort?
        </legend>
        {OUTCOMES.map((o, i) => (
          <label
            key={o}
            className={row ? 'flex items-center gap-2 text-sm text-ink' : 'flex items-center gap-2 text-ink'}
          >
            <input
              ref={(el) => {
                radioRefs.current[i] = el
              }}
              type="radio"
              name={name}
              value={o}
              checked={outcome === o}
              onChange={() => setOutcome(o)}
              onKeyDown={(event) => {
                if (event.key === 'Tab') {
                  event.preventDefault()
                  cycleFocus(event.currentTarget, event.shiftKey)
                } else if (event.key === 'Enter') {
                  event.preventDefault()
                  // Enter selects the focused option and moves straight on.
                  setOutcome(o)
                  void save(o)
                }
              }}
              className="accent-primary"
            />
            {OUTCOME_LABELS[o]}
          </label>
        ))}
      </fieldset>

      {aiCheck ? (
        <AiAnswerCheck
          questionId={aiCheck.questionId}
          answer={aiCheck.answer}
          onSuggest={suggestOutcome}
          buttonRef={askRef}
          onButtonKeyDown={(event) => {
            if (event.key === 'Tab') {
              event.preventDefault()
              cycleFocus(event.currentTarget, event.shiftKey)
            }
          }}
        />
      ) : null}

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <button
        ref={continueRef}
        type="button"
        className={styles.button}
        disabled={!outcome || isSaving}
        onClick={() => void save(outcome)}
      >
        {isSaving ? 'Wird gespeichert…' : 'Weiter'}
      </button>
    </>
  )
}
