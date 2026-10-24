import { useRef, useState } from 'react'

import { buttonClass } from '../components/buttonStyles'
import { ImageLightbox } from '../components/ImageLightbox'
import { Modal } from '../components/Modal'
import { pointsLabel } from '../chartPoints'
import { ORIGINALS_PATH, type NavigationExport, type NavigationImage, type NavigationTask } from './navigationCatalog'
import { OfficialResult, OfficialText, OwnAnswer } from './NavigationParts'
import { currentSubtask, type NavigationRunState } from './navigationRun'

// What stays at hand during a Navigationsaufgabe, the way the Kartenaufgaben of SKS Lotse have it
// (components/ChartTools.tsx): the task as the PDF prints it and the subtasks done so far. Beside the
// run on a wide screen as cards that fold open and shut, behind a bar at the bottom on a phone.

const PANELS = { original: 'Offizieller Originaltext', history: 'Verlauf' } as const
type Panel = keyof typeof PANELS
const PANEL_KEYS = Object.keys(PANELS) as Panel[]

interface ToolsProps {
  data: NavigationExport
  task: NavigationTask
  run: NavigationRunState
}

// The current subtask as the PDF prints it (the last one once the run is complete), its official
// result only once answered — as SKS Lotse's Kartenaufgaben show their original (ADR-0063).
function OriginalText({ data, task, run }: ToolsProps) {
  const [zoomed, setZoomed] = useState<NavigationImage | null>(null)
  const number = currentSubtask(task, run) ?? task.subtasks.length
  const subtask = task.subtasks.find((s) => s.number === number)
  if (!subtask?.original) return <p className="text-sm text-ink-soft">Kein Ausschnitt vorhanden.</p>
  const images = run.answers[number]
    ? [subtask.original.question, subtask.original.result]
    : [subtask.original.question]
  const alt = `Teilaufgabe ${number} der Navigationsaufgabe ${task.number} im Original`
  return (
    <div className="flex flex-col gap-2">
      {images.map((image) => (
        <button key={image.src} type="button" className="block cursor-zoom-in" onClick={() => setZoomed(image)}>
          <img
            src={`${ORIGINALS_PATH}${image.src}`}
            width={image.width}
            height={image.height}
            alt={image === subtask.original!.result ? `Ergebnis zu ${alt}` : alt}
            className="h-auto max-w-full rounded-tile border border-border bg-surface"
          />
        </button>
      ))}
      <p className="text-xs text-ink-soft">Antippen zum Vergrößern. Quelle: {data.source}</p>
      {zoomed ? (
        <ImageLightbox
          src={`${ORIGINALS_PATH}${zoomed.src}`}
          width={zoomed.width}
          height={zoomed.height}
          alt={alt}
          onClose={() => setZoomed(null)}
        />
      ) : null}
    </div>
  )
}

/** Every answered subtask, in order, each opening to its question, the answer and the official result. */
function SubtaskHistory({ data, task, run }: ToolsProps) {
  const answered = task.subtasks.filter((subtask) => run.answers[subtask.number])
  if (answered.length === 0) return <p className="text-sm text-ink-soft">Noch keine Teilaufgabe beantwortet.</p>
  return (
    <ul className="flex flex-col">
      {answered.map((subtask) => {
        const answer = run.answers[subtask.number]
        return (
          <li key={subtask.number} className="border-b border-border last:border-b-0">
            <details>
              <summary className="flex cursor-pointer justify-between gap-3 py-2 text-sm text-ink">
                <span>Teilaufgabe {subtask.number}</span>
                <span className="font-mono text-xs text-ink-soft">
                  {answer.point === null ? 'noch nicht bewertet' : `${answer.point} / ${pointsLabel(1)}`}
                </span>
              </summary>
              <div className="flex flex-col gap-3 pb-3 text-sm">
                <p className="text-ink">
                  <OfficialText data={data} task={task} subtask={subtask} field="text" />
                </p>
                <OwnAnswer answer={answer.answer} />
                <OfficialResult data={data} task={task} subtask={subtask} />
              </div>
            </details>
          </li>
        )
      })}
    </ul>
  )
}

function PanelContent({ panel, ...props }: ToolsProps & { panel: Panel }) {
  return panel === 'original' ? <OriginalText {...props} /> : <SubtaskHistory {...props} />
}

// Which cards were open stays in this browser, so the layout the learner chose survives the next task.
const OPEN_KEY = 'sbf-lotse:navigation-tools-open'

function loadOpen(): Record<Panel, boolean> {
  const initial = { original: false, history: true }
  try {
    return {
      ...initial,
      ...(JSON.parse(window.localStorage.getItem(OPEN_KEY) ?? '{}') as Partial<Record<Panel, boolean>>),
    }
  } catch {
    return initial
  }
}

export function NavigationSidePanel(props: ToolsProps) {
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

export function NavigationToolBar(props: ToolsProps) {
  const [open, setOpen] = useState<Panel | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <nav
        aria-label="Hilfsmittel"
        className="fixed inset-x-0 bottom-0 z-(--z-bar) flex justify-around border-t border-border bg-surface py-2"
      >
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
