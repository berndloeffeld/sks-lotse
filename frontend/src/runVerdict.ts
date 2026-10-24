import type { ExamResult } from './api/types'

// Whether a run passed, by its points and the threshold of its collection: SBF Lotse's
// Navigationsaufgabe passes from 7 of 9 (ELWIS Bewertungsschlüssel).

export interface RunVerdict {
  passed: boolean
  // Points still missing to pass (0 once passed).
  missing: number
}

export function runVerdict(points: number, passPoints: number): RunVerdict {
  return { passed: points >= passPoints, missing: Math.max(0, passPoints - points) }
}

// SKS Lotse's Kartenaufgaben, 30 points each, per the Durchführungsrichtlinien SKS Nr. 6.2:
// 16 or fewer failed, 17 to 19 an oral re-examination, 20 or more passed.
export const CHART_PASS_MIN_POINTS = 20
export const CHART_ORAL_MIN_POINTS = 17

export function chartRunResult(points: number): ExamResult {
  if (points >= CHART_PASS_MIN_POINTS) return 'bestanden'
  if (points >= CHART_ORAL_MIN_POINTS) return 'muendliche_nachpruefung'
  return 'nicht_bestanden'
}
