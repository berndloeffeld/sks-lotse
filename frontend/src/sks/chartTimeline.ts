// The time axis of the learning status's Kartenaufgaben chart (components/ChartStatsPanel.tsx), kept
// apart from the markup so it can be tested and mutated on its own. The axis runs to scale from the
// day of the first completed run to today, one equal slot per day; runs of the same day share its slot.

const DAY_MS = 24 * 60 * 60 * 1000

// The learner's local calendar day as a running day number, so a DST switch never shifts it.
export function localDayNumber(date: Date): number {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS)
}

export interface DaySlot<T> {
  // Days after the axis's first day.
  offset: number
  // The day's runs in the order given (oldest first).
  runs: T[]
}

export interface TimeAxis<T> {
  // The first day's day number (localDayNumber).
  firstDay: number
  // The days on the axis, the first run's day and today included; at least 1.
  dayCount: number
  slots: DaySlot<T>[]
  // Offsets of the labelled days, oldest first: today and every `tickStep` days back from it.
  ticks: number[]
}

// A step of 1, 2, 7, 14 or 28 days, the smallest that labels at most MAX_TICKS days.
const MAX_TICKS = 6
const TICK_STEPS = [1, 2, 7, 14, 28]

export function tickStep(dayCount: number): number {
  return TICK_STEPS.find((step) => Math.ceil(dayCount / step) <= MAX_TICKS) ?? Math.ceil(dayCount / MAX_TICKS)
}

export function timeAxis<T>(runs: readonly T[], completedAt: (run: T) => string, today: Date): TimeAxis<T> {
  const days = runs.map((run) => localDayNumber(new Date(completedAt(run))))
  const first = Math.min(localDayNumber(today), ...days)
  const dayCount = localDayNumber(today) - first + 1
  const slots: DaySlot<T>[] = []
  runs.forEach((run, index) => {
    const offset = days[index] - first
    const slot = slots.find((candidate) => candidate.offset === offset)
    if (slot) slot.runs.push(run)
    else slots.push({ offset, runs: [run] })
  })
  const step = tickStep(dayCount)
  const ticks = Array.from({ length: Math.ceil(dayCount / step) }, (_, index) => dayCount - 1 - index * step).reverse()
  return { firstDay: first, dayCount, slots, ticks }
}

// The local calendar day of a day number, for a tick's label.
export function dayFromNumber(dayNumber: number): Date {
  const utc = new Date(dayNumber * DAY_MS)
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate())
}
