import { useCallback, useState } from 'react'

// The learner's own "Formblatt Gezeiten" for one Kartenaufgabe run: the paper form's fields, typed in
// instead of written. Scratch work like the chart itself, so it stays in this browser (localStorage,
// per run) and never goes to the server.

export type TideAge = '' | 'spring' | 'mid' | 'neap'
export type TideKind = '' | 'H' | 'N'

export interface TideCell {
  time: string
  height: string
}

// One column of the form: "1. HW", "2. NW", … with the rows Bezugsort, ZUG/HUG, Anschlussort, and the
// Bordzeit (a time only).
export interface TideEvent {
  kind: TideKind
  reference: TideCell
  difference: TideCell
  secondary: TideCell
  boardTime: string
}

export interface TideBlock {
  age: TideAge
  date: string
  events: TideEvent[]
}

export interface TideForm {
  referencePort: string
  secondaryPort: string
  secondaryPortNumber: string
  date: string
  timeZone: string
  boardTime: string
  blocks: TideBlock[]
}

// The printed form: "1. _W", "1. _W", "2. _W", "2. _W" in each of its two halves.
export const EVENT_ORDINALS = [1, 1, 2, 2]
const BLOCK_COUNT = 2

const emptyCell = (): TideCell => ({ time: '', height: '' })

export function emptyTideForm(): TideForm {
  return {
    referencePort: '',
    secondaryPort: '',
    secondaryPortNumber: '',
    date: '',
    timeZone: '',
    boardTime: '',
    blocks: Array.from({ length: BLOCK_COUNT }, () => ({
      age: '' as TideAge,
      date: '',
      events: EVENT_ORDINALS.map(() => ({
        kind: '' as TideKind,
        reference: emptyCell(),
        difference: emptyCell(),
        secondary: emptyCell(),
        boardTime: '',
      })),
    })),
  }
}

export const storageKey = (attemptId: string | number) => `sks-lotse:tide-form:${attemptId}`

// A stored form that doesn't have the current shape (older version, edited by hand) is dropped
// rather than half-used.
function isTideForm(value: unknown): value is TideForm {
  const form = value as TideForm | null
  return (
    typeof form === 'object' &&
    form !== null &&
    Array.isArray(form.blocks) &&
    form.blocks.length === BLOCK_COUNT &&
    form.blocks.every((block) => Array.isArray(block.events) && block.events.length === EVENT_ORDINALS.length)
  )
}

export function loadTideForm(attemptId: string | number): TideForm {
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey(attemptId)) ?? 'null') as unknown
    return isTideForm(stored) ? stored : emptyTideForm()
  } catch {
    return emptyTideForm()
  }
}

function saveTideForm(attemptId: string | number, form: TideForm) {
  try {
    window.localStorage.setItem(storageKey(attemptId), JSON.stringify(form))
  } catch {
    // Private mode or storage full: the form still works, it just won't survive a reload.
  }
}

// A guest's run has no id; the Formblatt is kept under the sheet's number.
export const guestTideFormId = (sheet: number) => `guest-${sheet}`

// A guest's new run starts with an empty form (ADR-0056); a learner's run has its own id anyway.
export function forgetTideForm(attemptId: string | number) {
  try {
    window.localStorage.removeItem(storageKey(attemptId))
  } catch {
    // Storage blocked: there is nothing stored to forget either.
  }
}

export function useTideForm(attemptId: string | number) {
  const [form, setForm] = useState<TideForm>(() => loadTideForm(attemptId))

  const update = useCallback(
    (change: (current: TideForm) => TideForm) => {
      setForm((current) => {
        const next = change(current)
        saveTideForm(attemptId, next)
        return next
      })
    },
    [attemptId],
  )

  const clear = useCallback(() => update(() => emptyTideForm()), [update])

  return { form, update, clear }
}
