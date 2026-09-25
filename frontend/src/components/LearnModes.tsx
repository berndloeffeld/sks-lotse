import type { KeyboardEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'

import type { RefreshSummary } from '../api/types'
import { percentOf } from '../format'
import { Band } from './Bands'
import { formStyles } from './formStyles'

export type LearnMode = 'topic' | 'focus' | 'refresh'

const LEARN_MODES: { id: LearnMode; label: string }[] = [
  { id: 'topic', label: 'Nach Thema' },
  { id: 'focus', label: 'Fokus' },
  { id: 'refresh', label: 'Auffrischen' },
]

const tabId = (mode: LearnMode) => `learn-tab-${mode}`

interface LearnModeTabsProps {
  active: LearnMode
  onChange: (mode: LearnMode) => void
}

// The three ways to learn as tabs: by topic (the list), Fokus and Auffrischen. Arrow keys
// move between them, as the tabs pattern expects.
export function LearnModeTabs({ active, onChange }: LearnModeTabsProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const next = LEARN_MODES[(index + step + LEARN_MODES.length) % LEARN_MODES.length].id
    onChange(next)
    document.getElementById(tabId(next))?.focus()
  }

  return (
    <Band className="pb-0">
      <div role="tablist" aria-label="Lernmodus" className="flex border-b border-border">
        {LEARN_MODES.map((mode, index) => {
          const selected = mode.id === active
          return (
            <button
              key={mode.id}
              id={tabId(mode.id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`learn-panel-${mode.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(mode.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`-mb-px flex-1 border-b-2 px-2 py-3 font-serif text-lg transition sm:flex-none sm:px-6 ${
                selected ? 'border-primary text-primary' : 'border-transparent text-ink-soft hover:text-primary'
              }`}
            >
              {mode.label}
            </button>
          )
        })}
      </div>
    </Band>
  )
}

// The content of the selected tab, wired to its tab for assistive technology. The minimum height
// keeps a short tab (Auffrischen) from shrinking the page, which would make the browser pull the
// scroll position up and move the tab bar out from under the pointer.
export function LearnModePanel({ mode, children }: { mode: LearnMode; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`learn-panel-${mode}`} aria-labelledby={tabId(mode)} className="min-h-[70vh]">
      {children}
    </div>
  )
}

interface RefreshPanelProps {
  // The counts behind the session; null while they are still loading.
  summary: RefreshSummary | null
}

// The Auffrischen tab: how the learner's sicher gelernt questions are doing, and the start button
// while any could have faded or could fade soon (ADR-0049).
export function RefreshPanel({ summary }: RefreshPanelProps) {
  const { lapsed, expiring, fresh } = summary ?? { lapsed: 0, expiring: 0, fresh: 0 }
  const total = lapsed + expiring + fresh
  const due = lapsed + expiring

  return (
    <Band className="py-14">
      <div className="flex items-center justify-between gap-4 pr-2">
        <h2 className="font-serif text-3xl text-primary">Auffrischen</h2>
        {due > 0 ? (
          <Link to="/learn/refresh" className={formStyles('light').button}>
            Auffrischen starten
          </Link>
        ) : null}
      </div>
      {summary === null ? null : total === 0 ? (
        <p className="mt-3 max-w-xl text-sm text-ink-soft">
          Sobald du Fragen sicher gelernt hast, kannst du sie hier auffrischen, bevor sie verblassen.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div
              className="flex h-1.5 w-full bg-surface-alt"
              role="img"
              aria-label="Zustand der sicher gelernten Fragen"
            >
              <div className="h-full bg-danger" style={{ width: `${percentOf(lapsed, total)}%` }} />
              <div className="h-full bg-accent" style={{ width: `${percentOf(expiring, total)}%` }} />
              <div className="h-full bg-success" style={{ width: `${percentOf(fresh, total)}%` }} />
            </div>
            <p className="font-mono text-xs text-ink-soft">
              {lapsed} möglicherweise verblasst · {expiring} könnten bald verblassen · {fresh} noch frisch
            </p>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-balance text-ink-soft">
            {due > 0
              ? 'Jede Runde besteht aus bis zu 20 zufälligen Fragen, die möglicherweise verblasst sind oder bald verblassen könnten. Richtig beantwortet, gelten sie wieder als sicher gelernt.'
              : 'Gerade droht nichts zu verblassen. Komm in ein paar Tagen wieder.'}
          </p>
        </div>
      )}
    </Band>
  )
}
