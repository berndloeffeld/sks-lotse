import { useState } from 'react'
import { Link } from 'react-router-dom'

import { trackEvent, trackLandingClick } from '../analytics'
import type { GradingOutcome } from '../api/types'
import samples from '../data/landing_samples.gen.json'
import { SUBJECT_LABELS } from '../labels'
import { OfficialAnswerBox, OwnAnswer } from './AnswerBox'
import { buttonClass } from './buttonStyles'
import { formStyles } from './formStyles'
import { SelfAssessment } from './SelfAssessment'

// A few official questions, copied word for word by backend/scripts/export_catalog.py, so the
// landing page needn't load the whole catalog for its hero.
const SAMPLES = samples.questions

const FEEDBACK: Record<GradingOutcome, string> = {
  richtig: 'Sitzt. Mit Konto fragt SKS Lotse sie wieder ab, kurz bevor du sie vergessen würdest.',
  teilweise_richtig: 'Fast. Mit Konto kommt diese Frage wieder, bis sie sitzt.',
  falsch: 'Kein Problem. Mit Konto kommt diese Frage wieder, bis sie sitzt.',
}

type Phase = 'answer' | 'assess' | GradingOutcome

// The landing page's hero: one official question to try, the way "Lernen nach Thema" works for
// guests (ADR-0054): write, compare with the official answer, grade yourself. Nothing is saved or
// sent; `track` counts the steps for guests (landing_sample_revealed/_graded, ADR-0030). It always
// starts with the first sample, so the prerendered page and the hydrated one agree.
export function HeroSampleQuestion({ track }: { track: boolean }) {
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('answer')
  const [note, setNote] = useState('')
  const styles = formStyles('light')
  const sample = SAMPLES[index]

  function reveal() {
    setPhase('assess')
    if (track) trackEvent('landing_sample_revealed')
  }

  function grade(outcome: GradingOutcome) {
    setPhase(outcome)
    if (track) trackEvent('landing_sample_graded', { outcome })
    return Promise.resolve()
  }

  function next() {
    setIndex((index + 1) % SAMPLES.length)
    setPhase('answer')
    setNote('')
  }

  return (
    // Named by aria-label, not by the question: as a heading it would lead the page's outline,
    // ahead of what the page is about.
    <article
      aria-label="Beispielfrage"
      className="flex flex-col gap-4 rounded-tile bg-surface p-5 text-left text-ink sm:p-6"
    >
      <p className="font-mono text-xs tracking-wide text-ink-soft uppercase">
        Probier’s aus · {SUBJECT_LABELS[sample.subject]} · Nr.{' '}
        {sample.number}
      </p>
      <p className="font-serif text-lg leading-snug text-ink">{sample.question_text}</p>

      {phase === 'answer' ? (
        <>
          <label className={styles.label}>
            Deine Antwort
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              className={styles.input}
            />
          </label>
          <button type="button" className={`${buttonClass('primary')} self-start`} onClick={reveal}>
            Lösung anzeigen
          </button>
        </>
      ) : (
        <>
          {note.trim() ? <OwnAnswer text={note} /> : null}
          <OfficialAnswerBox text={sample.answer_text} images={[]} />
          {phase === 'assess' ? (
            <SelfAssessment
              key={index}
              name="beispielfrage-bewertung"
              layout="row"
              onSave={grade}
              saveErrorMessage="Die Bewertung konnte nicht übernommen werden."
              aiCheck={null}
            />
          ) : (
            <>
              <p role="status" className="text-sm text-ink">
                {FEEDBACK[phase]}
              </p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <Link
                  to={`/learn/${sample.subject}/${sample.topic}`}
                  onClick={track ? () => trackLandingClick('sample_topic') : undefined}
                  className={buttonClass('primary')}
                >
                  Alle Fragen zu „{sample.topic_name}“
                </Link>
                <button type="button" className="text-sm text-primary underline hover:no-underline" onClick={next}>
                  Andere Beispielfrage
                </button>
              </div>
              <p className="text-xs text-ink-soft">Ohne Anmeldung, wie diese Frage.</p>
            </>
          )}
        </>
      )}
    </article>
  )
}
