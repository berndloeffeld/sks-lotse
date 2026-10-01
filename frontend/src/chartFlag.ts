// The Kartenaufgaben flag for the build, VITE_CHART_EXERCISES (ADR-0056): the same values as the
// API's CHART_EXERCISES (off | admins | on), and render.yaml sets both alike. Only "on" opens the
// Kartenaufgaben to guests; who of the logged-in learners gets them, the API decides
// (UserRead.can_use_chart_exercises). Unset is "off"; a typo fails the build (vite.config.ts)
// instead of quietly falling back. No import.meta here, since vite.config.ts imports this too.

export type ChartFlag = 'off' | 'admins' | 'on'

const VALUES: readonly string[] = ['off', 'admins', 'on']

export function parseChartFlag(value: string | undefined): ChartFlag {
  if (!value) return 'off'
  if (!VALUES.includes(value)) {
    throw new Error(`VITE_CHART_EXERCISES must be one of off, admins, on — got "${value}"`)
  }
  return value as ChartFlag
}
