import type { ExamResult, ExamVariant, GradingOutcome } from './api/types'

// Display labels for fields the backend stores as fixed keys — shared by the
// learner's own pages and the admin view, so both show the same wording.
export const VARIANT_LABELS: Record<ExamVariant, string> = {
  segeln_und_motor: 'Motor und Segeln',
  motor: 'Motor',
}

// Mirrors GENDERS in backend/app/schemas/auth.py. Blank/"keine Angabe" is
// null on the User, not a key here.
export const GENDER_LABELS: Record<string, string> = {
  maennlich: 'Männlich',
  weiblich: 'Weiblich',
  divers: 'Divers',
}

// The self-assessment control's options, in the order ADR-0014 fixes:
// plain labels, no color-coding.
export const OUTCOME_LABELS: Record<GradingOutcome, string> = {
  richtig: 'Richtig',
  teilweise_richtig: 'Teilweise Richtig',
  falsch: 'Falsch',
}

// Mirrors SUBJECT_GROUPS in backend/app/core/exam.py.
export const SUBJECT_GROUP_LABELS: Record<string, string> = {
  navigation: 'Navigation',
  schifffahrtsrecht: 'Schifffahrtsrecht',
  wetterkunde: 'Wetterkunde',
  seemannschaft: 'Seemannschaft',
}

// Per the Durchführungsrichtlinien Nr. 6.2.1, for the Fragebogen part only.
export const EXAM_RESULT_LABELS: Record<ExamResult, string> = {
  bestanden: 'Bestanden',
  muendliche_nachpruefung: 'Mündliche Nachprüfung erforderlich',
  nicht_bestanden: 'Nicht bestanden',
}
