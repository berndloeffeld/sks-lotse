import { ApiError } from './api/client'

// What a failed Lotsen-Check tells the learner (ADR-0031, ADR-0058): whatever went wrong, the
// self-assessment still works.
export function lotseErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) {
    return 'Der Lotse ist für diese Frage oder für heute ausgelastet. Bewerte dich bitte selbst.'
  }
  if (error instanceof ApiError && error.status === 422) {
    return 'Diese Antwort kann der Lotse nicht prüfen. Bewerte dich bitte selbst.'
  }
  if (error instanceof ApiError && error.status === 402) {
    return 'Deine Tokens sind aufgebraucht. Bewerte dich bitte selbst.'
  }
  return 'Der Lotse ist gerade nicht erreichbar. Bewerte dich bitte selbst.'
}
