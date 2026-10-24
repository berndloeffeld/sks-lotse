// Whether a run passed, by its points and the threshold of its collection: SBF Lotse's
// Navigationsaufgabe passes from 7 of 9 (ELWIS Bewertungsschlüssel). SKS Lotse's Kartenaufgaben have
// no threshold and don't use this.

export interface RunVerdict {
  passed: boolean
  // Points still missing to pass (0 once passed).
  missing: number
}

export function runVerdict(points: number, passPoints: number): RunVerdict {
  return { passed: points >= passPoints, missing: Math.max(0, passPoints - points) }
}
