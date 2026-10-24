import type { ExamResult } from './api/types'

// SKS Lotse's Kartenaufgaben, 30 points each, per the Durchführungsrichtlinien SKS Nr. 6.2:
// 16 or fewer failed, 17 to 19 an oral re-examination, 20 or more passed.
export const CHART_PASS_MIN_POINTS = 20
export const CHART_ORAL_MIN_POINTS = 17

export function chartRunResult(points: number): ExamResult {
  if (points >= CHART_PASS_MIN_POINTS) return 'bestanden'
  if (points >= CHART_ORAL_MIN_POINTS) return 'muendliche_nachpruefung'
  return 'nicht_bestanden'
}
