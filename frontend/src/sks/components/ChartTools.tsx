import { useRef, useState } from 'react'

import type { ChartAttempt, ChartExercisesOverview } from '../api/types'
import { pointsLabel } from '../../shared/chartPoints'
import type { useTideForm } from '../hooks/useTideForm'
import { ChartAiSuggestionView } from './ChartAiCheck'
import { ChartOwnAnswer } from './AnswerBox'
import { ChartImages, ChartTaskText, OfficialSolution } from './ChartContent'
import { ChartTaskVideo } from './ChartSheetVideo'
import { TideFormFields } from './TideFormFields'
import { buttonClass } from '../../shared/components/buttonStyles'
import { Modal } from '../../shared/components/Modal'

// What stays at hand during a Kartenaufgabe: the Formblatt Gezeiten to fill in, the current task as
// the PDF prints it, the tasks done so far with the learner's answers and the solutions. (The sheet's rules are read before the start, on
// ChartExercisePage.) Beside the task on a wide screen
// as cards that fold open and shut (ChartSidePanel), behind a bar at the bottom on a phone (ChartToolBar).
// First of them, where the sheet has one, a link to a video explaining the current task (ChartSheetVideo).

const PANELS = { form: 'Formblatt Gezeiten', original: 'Offizieller Originaltext', history: 'Verlauf' } as const
type Panel = keyof typeof PANELS
const PANEL_KEYS = Object.keys(PANELS) as Panel[]

interface ToolsProps {
  attempt: ChartAttempt
  overview: ChartExercisesOverview | null
  // The learner's filled-in form, owned by the page so the side panel and the phone sheet share it.
  tideForm: ReturnType<typeof useTideForm>
}

export function TideForm({ overview }: { overview: ChartExercisesOverview | null }) {
  if (!overview) return <p className="text-sm text-ink-soft">Wird geladen…</p>
  const src = `/charts/${overview.tide_form.src}`
  return (
    <div className="flex flex-col gap-2">
      <a href={src} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
        In neuem Tab öffnen (zum Vergrößern oder Drucken)
      </a>
      <img
        src={src}
        width={overview.tide_form.width}
        height={overview.tide_form.height}
        alt="Formblatt Gezeiten (leer)"
        className="h-auto max-w-full rounded-tile border border-border bg-surface"
      />
    </div>
  )
}

export function ChartHints({ overview }: { overview: ChartExercisesOverview | null }) {
  if (!overview) return <p className="text-sm text-ink-soft">Wird geladen…</p>
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink">
      {overview.hints.map((hint) => (
        <p key={hint}>{hint}</p>
      ))}
      <p className="text-xs text-ink-soft">Quelle: {overview.source}</p>
    </div>
  )
}

/** Every answered task, in the sheet's order, each opening to its text, the answer and the solution. */
export function ChartTaskHistory({ attempt }: { attempt: ChartAttempt }) {
  const answered = attempt.tasks.filter((task) => task.answer_text !== null)
  if (answered.length === 0) return <p className="text-sm text-ink-soft">Noch keine Aufgabe beantwortet.</p>
  return (
    <ul className="flex flex-col">
      {answered.map((task) => (
        <li key={task.number} className="border-b border-border last:border-b-0">
          <details>
            <summary className="flex cursor-pointer justify-between gap-3 py-2 text-sm text-ink">
              <span>Aufgabe {task.number}</span>
              <span className="font-mono text-xs text-ink-soft">
                {task.points_awarded === null
                  ? 'noch nicht bewertet'
                  : `${task.points_awarded} / ${pointsLabel(task.max_points)}`}
              </span>
            </summary>
            <div className="flex flex-col gap-3 pb-3">
              <ChartTaskText task={task} />
              <ChartOwnAnswer text={task.answer_text} />
              <OfficialSolution task={task} />
              {task.ai_suggestion ? (
                <ChartAiSuggestionView suggestion={task.ai_suggestion} maxPoints={task.max_points} hint={false} />
              ) : null}
            </div>
          </details>
        </li>
      ))}
    </ul>
  )
}

function FillableTideForm({ overview, tideForm }: Pick<ToolsProps, 'overview' | 'tideForm'>) {
  return (
    <div className="flex flex-col gap-2">
      <TideFormFields {...tideForm} />
      {overview ? (
        <a
          href={`/charts/${overview.tide_form.src}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary underline"
        >
          Leeres Original öffnen (zum Drucken)
        </a>
      ) : null}
    </div>
  )
}

/** The current task as the sheet prints it (the last one once the run is complete), for the Formblatt's data. */
function OriginalText({ attempt, source }: { attempt: ChartAttempt; source: string | undefined }) {
  const task = attempt.tasks.find((t) => t.number === attempt.current_task) ?? attempt.tasks.at(-1)
  if (!task || task.task_images.length === 0) return <p className="text-sm text-ink-soft">Kein Ausschnitt vorhanden.</p>
  return (
    <div className="flex flex-col gap-2">
      <ChartImages images={task.task_images} alt={`Aufgabe ${task.number} im Original`} />
      {task.solution_images.length > 0 ? (
        <ChartImages images={task.solution_images} alt={`Lösung zu Aufgabe ${task.number} im Original`} />
      ) : null}
      <p className="text-xs text-ink-soft">Antippen zum Vergrößern.{source ? ` Quelle: ${source}` : ''}</p>
    </div>
  )
}

/** The video link at the head of the tools; nothing for a sheet without a video. */
function VideoLink({ attempt, className, label }: { attempt: ChartAttempt; className: string; label: string }) {
  const task = attempt.current_task ?? attempt.tasks.at(-1)?.number ?? 1
  return (
    <ChartTaskVideo sheet={attempt.exercise_number} task={task} className={className}>
      {label} <span aria-hidden="true">↗</span>
    </ChartTaskVideo>
  )
}

function PanelContent({ panel, attempt, overview, tideForm }: ToolsProps & { panel: Panel }) {
  if (panel === 'form') return <FillableTideForm overview={overview} tideForm={tideForm} />
  if (panel === 'original') return <OriginalText attempt={attempt} source={overview?.source} />
  return <ChartTaskHistory attempt={attempt} />
}

// Which cards were open stays in this browser, so the layout the learner chose survives the next task.
const OPEN_KEY = 'sks-lotse:chart-tools-open'

function loadOpen(): Record<Panel, boolean> {
  const initial = { form: true, original: false, history: false }
  try {
    return {
      ...initial,
      ...(JSON.parse(window.localStorage.getItem(OPEN_KEY) ?? '{}') as Partial<Record<Panel, boolean>>),
    }
  } catch {
    return initial
  }
}

export function ChartSidePanel(props: ToolsProps) {
  const [open, setOpen] = useState(loadOpen)

  function toggle(panel: Panel) {
    setOpen((current) => {
      const next = { ...current, [panel]: !current[panel] }
      try {
        window.localStorage.setItem(OPEN_KEY, JSON.stringify(next))
      } catch {
        // Not stored, still toggled.
      }
      return next
    })
  }

  return (
    <aside aria-label="Hilfsmittel" className="flex flex-col gap-3">
      <VideoLink
        attempt={props.attempt}
        label="Video zur Aufgabe"
        className="flex w-full items-center justify-between rounded-tile border border-border bg-surface px-3 py-2 font-mono text-xs tracking-wide text-primary uppercase hover:underline"
      />
      {PANEL_KEYS.map((key) => (
        <section key={key} className="rounded-tile border border-border bg-surface">
          <h2>
            <button
              type="button"
              aria-expanded={open[key]}
              onClick={() => toggle(key)}
              className="flex w-full items-center justify-between px-3 py-2 font-mono text-xs tracking-wide text-primary uppercase"
            >
              {PANELS[key]}
              <span aria-hidden="true" className={`transition-transform ${open[key] ? 'rotate-180' : ''}`}>
                ▾
              </span>
            </button>
          </h2>
          {open[key] ? (
            <div className="border-t border-border p-3">
              <PanelContent panel={key} {...props} />
            </div>
          ) : null}
        </section>
      ))}
    </aside>
  )
}

export function ChartToolBar(props: ToolsProps) {
  const [open, setOpen] = useState<Panel | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  // The sheet is a Modal: focus starts on "Schließen", stays inside, and goes back to the bar's
  // button on close; Escape and a tap on the dimmed page above it close it too.
  return (
    <>
      <nav
        aria-label="Hilfsmittel"
        className="fixed inset-x-0 bottom-0 z-(--z-bar) flex justify-around border-t border-border bg-surface py-2"
      >
        <VideoLink
          attempt={props.attempt}
          label="Video"
          className="px-3 py-1 font-mono text-xs tracking-wide whitespace-nowrap text-primary uppercase"
        />
        {PANEL_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-expanded={open === key}
            onClick={() => setOpen(key)}
            className="px-3 py-1 font-mono text-xs tracking-wide text-primary uppercase"
          >
            {PANELS[key]}
          </button>
        ))}
      </nav>
      {open ? (
        <Modal label={PANELS[open]} placement="sheet" onClose={() => setOpen(null)} initialFocusRef={closeRef}>
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl text-ink">{PANELS[open]}</h2>
            <button ref={closeRef} type="button" onClick={() => setOpen(null)} className={buttonClass('tertiary')}>
              Schließen
            </button>
          </div>
          <PanelContent panel={open} {...props} />
        </Modal>
      ) : null}
    </>
  )
}
