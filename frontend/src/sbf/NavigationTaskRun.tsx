import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

import { trackEvent } from '../shared/analytics'
import { buttonClass } from '../shared/components/buttonStyles'
import { formStyles } from '../shared/components/formStyles'
import { ErrorMessage } from '../shared/components/Messages'
import { sectionHeading } from '../shared/components/headingStyles'
import { Modal } from '../shared/components/Modal'
import { useEnterShortcut } from '../shared/hooks/useEnterShortcut'
import { LotseCheckButton } from '../shared/components/LotseCheckButton'
import { useAsyncAction } from '../shared/hooks/useAsyncAction'
import { useCheckLimits } from '../shared/hooks/useCheckLimits'
import { useLeaveConfirmation } from '../shared/hooks/useLeaveConfirmation'
import { lotseErrorMessage } from '../shared/lotseErrorMessage'
import { scrollBelowIntoView } from '../shared/scroll'
import { sbfAccountsOpen } from '../shared/siteConfig'
import type { SbfNavigationAiSuggestion } from './api/types'
import { useNavigationAttempt } from './hooks/useNavigationAttempt'
import type { NavigationExport, NavigationTask } from './navigationCatalog'
import { OfficialResult, OfficialText, OwnAnswer } from './NavigationParts'
import { NavigationSidePanel, NavigationToolBar } from './NavigationTools'
import {
  answerSubtask,
  currentSubtask,
  gradeSubtask,
  isRunInProgress,
  navigationResult,
  startNavigationRun,
  type NavigationRunState,
} from './navigationRun'
import { attemptToRunState, subtaskCheck, type SubtaskCheck } from './savedRun'

const FOLLOW_ON_NOTE = 'Ein Fehler, der nur aus einem früheren folgt, zählt als richtig (SpFV Anlage 3 Nr. 1.1).'

interface NavigationTaskRunProps {
  data: NavigationExport
  task: NavigationTask
}

// What the Lotsen-Check offers in a run (ADR-0071): a guest sees it as a teaser (with accounts on SBF
// Lotse), a learner checks the subtasks of a saved run. Without accounts the run only says "bald".
type CheckOffer =
  | { kind: 'soon' }
  | { kind: 'teaser' }
  | {
      kind: 'saved'
      forSubtask: (number: number) => SubtaskCheck | null
      onCheck: (number: number) => Promise<void>
    }

interface RunViewProps {
  data: NavigationExport
  task: NavigationTask
  run: NavigationRunState
  onAnswer: (answer: string) => void
  onGrade: (correct: boolean) => void
  onRestart: () => void
  check: CheckOffer
  // What the evaluation says about keeping the run.
  keepNote: string
  error?: string | null
  dialog?: ReactNode
}

// A guest's run through one Navigationsaufgabe (ADR-0068), in the page only: the situation stays in
// view, the subtasks come one after the other, and the run ends with the evaluation by the
// Bewertungsschlüssel. Beside it, as with SKS Lotse's Kartenaufgaben, the original and the subtasks done
// (NavigationTools: cards on a wide screen, a bar at the bottom on a phone).
export function NavigationTaskRun({ data, task }: NavigationTaskRunProps) {
  const [run, setRun] = useState<NavigationRunState>(startNavigationRun)
  const leave = useLeaveConfirmation(isRunInProgress(task, run))
  const result = navigationResult(task, run, data.pass_points)
  const current = currentSubtask(task, run)
  const accounts = sbfAccountsOpen()

  useEffect(() => {
    if (result) trackEvent('guest_navigation_run_completed', { task: task.number, points: result.points })
  }, [result, task.number])

  return (
    <RunView
      data={data}
      task={task}
      run={run}
      onAnswer={(answer) => setRun((state) => answerSubtask(task, state, current!, answer))}
      onGrade={(correct) => setRun((state) => gradeSubtask(task, state, current!, correct))}
      onRestart={() => setRun(startNavigationRun())}
      check={accounts ? { kind: 'teaser' } : { kind: 'soon' }}
      keepNote={
        accounts
          ? 'Gespeichert wird ohne Konto nichts. Mit Anmeldung bleiben deine Läufe erhalten, und der Lotse prüft deine Antworten.'
          : 'Gespeichert wird ohne Konto nichts; Konten und der Lotsen-Check kommen bald.'
      }
      dialog={leave.state === 'blocked' ? <DiscardRunDialog onStay={leave.reset} onDiscard={leave.proceed} /> : null}
    />
  )
}

// A learner's saved run (ADR-0071): the same run, kept on the server — it survives a reload and is
// resumed where it was left — with the Lotsen-Check for each subtask.
export function SavedNavigationTaskRun({ data, task }: NavigationTaskRunProps) {
  const { attempt, failed, reload, answer, grade, aiCheck, restart } = useNavigationAttempt(task.number)
  const { run: save, error } = useAsyncAction()

  if (!attempt) {
    return failed ? (
      <div className="flex flex-col items-start gap-3">
        <p className="text-danger">Dein Lauf konnte nicht geladen werden.</p>
        <button type="button" className={buttonClass('secondary')} onClick={() => void reload()}>
          Erneut laden
        </button>
      </div>
    ) : (
      <p role="status" className="text-ink-soft">
        Lädt …
      </p>
    )
  }
  const run = attemptToRunState(attempt)
  const current = currentSubtask(task, run)
  const saveFailed = 'Das hat nicht geklappt. Bitte erneut versuchen.'

  return (
    <RunView
      data={data}
      task={task}
      run={run}
      onAnswer={(text) => void save(() => answer(current!, text), saveFailed)}
      onGrade={(correct) => void save(() => grade(current!, correct), saveFailed)}
      onRestart={restart}
      check={{ kind: 'saved', forSubtask: (number) => subtaskCheck(attempt, number), onCheck: aiCheck }}
      keepNote="Dein Lauf ist in deinem Konto gespeichert."
      error={error}
    />
  )
}

function RunView({ data, task, run, onAnswer, onGrade, onRestart, check, keepNote, error, dialog }: RunViewProps) {
  const result = navigationResult(task, run, data.pass_points)
  const current = currentSubtask(task, run)

  return (
    <div className="grid gap-8 pb-16 lg:grid-cols-[minmax(0,1fr)_28rem] lg:pb-0">
      <div className="flex flex-col gap-6">
        <Situation task={task} />
        {current !== null ? (
          <CurrentSubtask
            key={current}
            data={data}
            task={task}
            number={current}
            run={run}
            onAnswer={onAnswer}
            onGrade={onGrade}
            check={check}
          />
        ) : null}
        <ErrorMessage>{error ?? null}</ErrorMessage>
        {result ? (
          <section
            aria-labelledby="auswertung"
            className="flex flex-col gap-3 rounded-tile border-2 border-primary p-4"
          >
            <h2 id="auswertung" className={sectionHeading}>
              Auswertung
            </h2>
            <p className="text-lg text-ink">
              {result.points} von {result.max} Punkten:{' '}
              <strong className={result.passed ? 'text-success' : 'text-danger'}>
                {result.passed ? 'bestanden' : 'nicht bestanden'}
              </strong>
            </p>
            <p className="text-sm text-ink-soft">
              Bestanden ist die Navigationsaufgabe ab {data.pass_points} Punkten
              {result.passed ? '.' : `, dir fehlen ${result.missing}.`} {keepNote}
            </p>
            <div className="flex flex-wrap gap-3">
              <button type="button" className={buttonClass('primary')} onClick={onRestart}>
                Noch einmal
              </button>
            </div>
          </section>
        ) : null}
      </div>
      <div className="hidden lg:block">
        <div className="sticky top-[calc(var(--header-height)+1.75rem)] max-h-[calc(100vh-var(--header-height)-2.75rem)] overflow-y-auto">
          <NavigationSidePanel data={data} task={task} run={run} />
        </div>
      </div>
      <div className="lg:hidden">
        <NavigationToolBar data={data} task={task} run={run} />
      </div>
      {dialog}
    </div>
  )
}

function Situation({ task }: { task: NavigationTask }) {
  return (
    <section aria-label="Situation" className="flex flex-col gap-2 border-l-4 border-primary bg-surface p-4 text-ink">
      {task.situation.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </section>
  )
}

function CurrentSubtask({
  data,
  task,
  number,
  run,
  onAnswer,
  onGrade,
  check,
}: {
  data: NavigationExport
  task: NavigationTask
  number: number
  run: NavigationRunState
  onAnswer: (answer: string) => void
  onGrade: (correct: boolean) => void
  check: CheckOffer
}) {
  const subtask = task.subtasks.find((s) => s.number === number)!
  const answered = run.answers[number]
  const titleId = useId()
  const saved = check.kind === 'saved' ? check.forSubtask(number) : null
  const suggestion = saved?.suggestion ?? null

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-4">
      <p className="font-mono text-xs tracking-wide text-ink-soft uppercase">
        Teilaufgabe {number} von {task.subtasks.length}
      </p>
      <h2 id={titleId} className="text-lg text-ink">
        <OfficialText data={data} task={task} subtask={subtask} field="text" />
      </h2>
      {answered ? (
        <PointsForm
          onGrade={onGrade}
          suggested={suggestion ? (suggestion.correct ? 1 : 0) : null}
          check={<SubtaskCheckBlock check={check} number={number} answer={answered.answer} saved={saved} />}
        >
          <OwnAnswer answer={answered.answer} />
          <OfficialResult data={data} task={task} subtask={subtask} />
        </PointsForm>
      ) : (
        <AnswerForm onAnswer={onAnswer} />
      )}
    </section>
  )
}

// The Lotsen-Check under the points (ADR-0071), as with SKS Lotse's Kartenaufgaben: the button with its
// price and the balance, or its suggestion once given. Not for a chart entry, which it can't see.
function SubtaskCheckBlock({
  check,
  number,
  answer,
  saved,
}: {
  check: CheckOffer
  number: number
  answer: string
  saved: SubtaskCheck | null
}) {
  const { run, isPending, error } = useAsyncAction()
  const { sbfNavigationCheckTokens, maxAnswerChars } = useCheckLimits()
  if (check.kind === 'soon') return <p className="text-xs text-ink-soft">Lotsen-Check: bald.</p>
  if (saved && !saved.checkable) return null
  if (saved?.suggestion) return <NavigationAiSuggestionView suggestion={saved.suggestion} />

  let blockedHint: string | null = null
  if (check.kind === 'saved') {
    if (answer.trim().length === 0) blockedHint = 'Ohne Antwort gibt es nichts zu prüfen'
    else if (answer.length > maxAnswerChars) blockedHint = `Nur für Antworten bis ${maxAnswerChars} Zeichen`
  }

  function onCheck() {
    if (check.kind !== 'saved') return
    void run(async () => {
      await check.onCheck(number)
      trackEvent('ai_check_used')
    }, lotseErrorMessage)
  }

  return (
    <div className="flex flex-col gap-3">
      <LotseCheckButton
        noticeId={`sbf-ai-check-notice-${number}`}
        cost={sbfNavigationCheckTokens}
        pitch="Die KI prüft deine Antwort, auch auf Folgefehler"
        isChecking={isPending}
        blockedHint={blockedHint}
        onCheck={onCheck}
      />
      <ErrorMessage>{error}</ErrorMessage>
    </div>
  )
}

// The Lotsen-Check's suggestion for a subtask: right or wrong, what's right or wrong, and the probable
// mistake. The point stays the learner's to give.
function NavigationAiSuggestionView({ suggestion }: { suggestion: SbfNavigationAiSuggestion }) {
  return (
    <section role="status" className="flex flex-col gap-1 rounded-tile border-l-4 border-accent bg-surface px-3 py-2">
      <h3 className="font-mono text-xs tracking-wide text-accent-strong uppercase">
        Lotsen-Vorschlag: {suggestion.correct ? 'richtig – 1 Punkt' : 'falsch – 0 Punkte'}
      </h3>
      <p className="text-sm text-ink-soft">{suggestion.feedback}</p>
      {suggestion.suspected_error ? (
        <p className="text-sm text-ink-soft">
          <strong className="font-semibold text-ink">Vermuteter Fehler:</strong> {suggestion.suspected_error}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-ink-soft">Nur ein Vorschlag – den Punkt gibst du dir selbst.</p>
    </section>
  )
}

// The answer, as in SKS Lotse's runs (components/ChartTaskRun.tsx, PracticeRun.tsx): the field has the
// focus, Enter shows the result and Shift+Enter is a line break (where there is a keyboard), and Tab
// goes on to the button in every browser (Safari's default Tab skips buttons).
function AnswerForm({ onAnswer }: { onAnswer: (answer: string) => void }) {
  const [draft, setDraft] = useState('')
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const submitRef = useRef<HTMLButtonElement>(null)
  const fieldId = useId()
  const style = formStyles('light')
  const enterShortcut = useEnterShortcut((event) => event.currentTarget.form?.requestSubmit())

  useEffect(() => {
    fieldRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        onAnswer(draft.trim())
      }}
    >
      <div className={style.label}>
        <label htmlFor={fieldId}>Deine Antwort</label>
        <textarea
          id={fieldId}
          ref={fieldRef}
          rows={4}
          className={style.input}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Tab' && !event.shiftKey) {
              event.preventDefault()
              submitRef.current?.focus()
              return
            }
            enterShortcut.onKeyDown(event)
          }}
        />
        {enterShortcut.enabled ? (
          <span className="text-xs text-ink-soft">Enter: Ergebnis anzeigen · Shift+Enter: neue Zeile</span>
        ) : null}
      </div>
      <button ref={submitRef} type="submit" className={`${buttonClass('primary')} self-start`}>
        Ergebnis anzeigen
      </button>
    </form>
  )
}

const CHOICES = [0, 1]

// The guest's own points for the subtask, as SKS Lotse's Kartenaufgaben ask for them (PointsForm in
// components/ChartTaskRun.tsx): focus goes to the group before the choices, so Tab lands on the first
// and keeps cycling through them without selecting; Enter on a choice gives those points and moves on.
function PointsForm({
  onGrade,
  suggested,
  check,
  children,
}: {
  onGrade: (correct: boolean) => void
  // The Lotsen-Check's point, preselected until the learner picks one themself.
  suggested: number | null
  check: ReactNode
  children: ReactNode
}) {
  const [chosen, setPoints] = useState<number | null>(null)
  const points = chosen ?? suggested
  const [error, setError] = useState<string | null>(null)
  const groupRef = useRef<HTMLFieldSetElement>(null)
  const continueRef = useRef<HTMLButtonElement>(null)
  const radioRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    // Clear of the tool bar a phone shows at the bottom of the screen.
    scrollBelowIntoView(continueRef.current, 64)
    groupRef.current?.focus({ preventScroll: true })
  }, [])

  function cycleFocus(from: HTMLInputElement, backwards: boolean) {
    const stops = radioRefs.current.filter((el): el is HTMLInputElement => el !== null)
    const at = stops.indexOf(from)
    stops[(at + (backwards ? stops.length - 1 : 1)) % stops.length]?.focus()
  }

  // `chosen` lets Enter on a choice save the points it just selected, before state has caught up.
  function save(chosen: number | null) {
    if (chosen === null) {
      setError('Wähle zuerst, wie viele Punkte du dir gibst.')
      return
    }
    onGrade(chosen === 1)
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        save(points)
      }}
    >
      {children}
      <fieldset ref={groupRef} tabIndex={-1} className="flex flex-col gap-2 outline-none">
        <legend className="mb-2 text-sm text-ink-soft">
          Wie viele Punkte hättest du in der Prüfung bekommen? {FOLLOW_ON_NOTE}
        </legend>
        <div className="flex flex-wrap gap-2">
          {CHOICES.map((choice) => (
            <label
              key={choice}
              className={`cursor-pointer rounded-tile border-2 px-4 py-2 font-mono text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-2 ${
                points === choice ? 'border-primary bg-primary text-surface' : 'border-primary text-primary'
              }`}
            >
              <input
                ref={(el) => {
                  radioRefs.current[choice] = el
                }}
                type="radio"
                name="points"
                value={choice}
                checked={points === choice}
                onChange={() => {
                  setPoints(choice)
                  setError(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Tab') {
                    event.preventDefault()
                    cycleFocus(event.currentTarget, event.shiftKey)
                  } else if (event.key === 'Enter') {
                    event.preventDefault()
                    setPoints(choice)
                    save(choice)
                  }
                }}
                className="sr-only"
              />
              {choice}
            </label>
          ))}
        </div>
      </fieldset>
      {check}
      <ErrorMessage>{error}</ErrorMessage>
      <button ref={continueRef} type="submit" className={`${buttonClass('primary')} self-start`}>
        Weiter
      </button>
    </form>
  )
}

// Before a navigation away from a started run: staying is the default.
function DiscardRunDialog({ onStay, onDiscard }: { onStay: () => void; onDiscard: () => void }) {
  const stayRef = useRef<HTMLButtonElement>(null)
  return (
    <Modal labelledBy="discard-nav-title" describedBy="discard-nav-text" onClose={onStay} initialFocusRef={stayRef}>
      <h2 id="discard-nav-title" className="font-serif text-xl text-primary">
        Durchgang verwerfen?
      </h2>
      <p id="discard-nav-text" className="text-ink-soft">
        Ohne Anmeldung wird der Durchgang nicht gespeichert. Wenn du die Seite verlässt, sind deine Antworten weg.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <button ref={stayRef} type="button" className={buttonClass('primary')} onClick={onStay}>
          Weiterarbeiten
        </button>
        <button type="button" className={buttonClass('danger')} onClick={onDiscard}>
          Verwerfen
        </button>
      </div>
    </Modal>
  )
}
