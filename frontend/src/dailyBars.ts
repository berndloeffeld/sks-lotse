// The arithmetic behind the admin dashboard's daily bar charts (components/DailyBars.tsx), kept
// apart from the SVG so it can be tested and mutated on its own.

// The highest value, 0 for an empty or all-zero series — never -Infinity.
export function seriesMax(values: readonly number[]): number {
  return Math.max(0, ...values)
}

export function seriesSum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

// Height of a bar of `value` in a chart `height` tall whose tallest bar is `max`; 0 when nothing to show.
export function barHeight(value: number, max: number, height: number): number {
  return max > 0 ? (value / max) * height : 0
}

// Per-day totals of stacked series: [[1, 2], [3, 4]] → [4, 6].
export function stackTotals(series: readonly (readonly number[])[]): number[] {
  const days = series[0]?.length ?? 0
  return Array.from({ length: days }, (_, day) => seriesSum(series.map((values) => values[day] ?? 0)))
}

// The API's day ("2026-10-12", a UTC day) as "12.10." — read as UTC so no timezone shifts it.
export function formatDay(isoDay: string): string {
  return new Date(`${isoDay}T00:00:00Z`).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  })
}
