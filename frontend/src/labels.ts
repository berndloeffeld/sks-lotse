import type { ExamResult, ExamVariant, GradingOutcome } from './api/types'

// Display labels for fields the backend stores as fixed keys — shared by the
// learner's own pages and the admin view, so both show the same wording.
export const VARIANT_LABELS: Record<ExamVariant, string> = {
  segeln_und_motor: 'Segeln und Motor',
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
  teilweise_richtig: 'Teilweise richtig',
  falsch: 'Falsch',
}

// The three outcomes, in the same fixed order — shared so PracticeRun's tally and
// SelfAssessment's radio group don't each re-derive it.
export const GRADING_OUTCOMES = Object.keys(OUTCOME_LABELS) as GradingOutcome[]

// Mirrors the catalog's subjects (backend/app/services/catalog_seed.py).
export const SUBJECT_LABELS: Record<string, string> = {
  navigation: 'Navigation',
  schifffahrtsrecht: 'Schifffahrtsrecht',
  wetterkunde: 'Wetterkunde',
  seemannschaft_allgemein: 'Seemannschaft',
  seemannschaft_motor: 'Seemannschaft (Motor)',
  seemannschaft_segeln: 'Seemannschaft (Segeln)',
}

// Mirrors SUBJECT_GROUPS in backend/app/domain/exam.py.
export const SUBJECT_GROUP_LABELS: Record<string, string> = {
  navigation: 'Navigation',
  schifffahrtsrecht: 'Schifffahrtsrecht',
  wetterkunde: 'Wetterkunde',
  seemannschaft: 'Seemannschaft',
}

// Mirrors PACKAGE_PRODUCTS in backend/app/domain/pricing.py (ADR-0043).
export const PACKAGE_PRODUCTS = ['tokens_s', 'tokens_m', 'tokens_l', 'tokens_xl'] as const
export type PackageProduct = (typeof PACKAGE_PRODUCTS)[number]
export const PACKAGE_LABELS: Record<PackageProduct, string> = {
  tokens_s: 'Paket S',
  tokens_m: 'Paket M',
  tokens_l: 'Paket L',
  tokens_xl: 'Paket XL',
}

// Per the Durchführungsrichtlinien Nr. 6.2.1, for the Fragebogen part only.
export const EXAM_RESULT_LABELS: Record<ExamResult, string> = {
  bestanden: 'Bestanden',
  muendliche_nachpruefung: 'Mündliche Nachprüfung erforderlich',
  nicht_bestanden: 'Nicht bestanden',
}

// One name per thing, in every UI text (app, landing, FAQ, legal pages). `use` is the word to
// write; `rejected` are the spellings that must not appear in UI text (src/typography.test.ts
// enforces it). Catalog wording is official and never touched; the exception is the source line in
// LegalFooter ("Musterantworten"). The Kartenaufgaben keep "amtliche Lösung".
// Legal texts (Datenschutz, AGB) address the reader with "Sie" or neutrally; the rest of the app says "du".
export const TERMS = [
  { use: 'Probeprüfung', rejected: ['Simulation', 'Prüfung starten'] },
  { use: 'Konto', rejected: ['Account'] },
  { use: 'Preise', rejected: ['Shop', 'Preise-Seite', 'Preise und Shop'] },
  { use: 'amtliche Antwort', rejected: ['Musterantwort'] },
  { use: 'gelernt', rejected: ['sicher gelernt', 'sicher gelernten'] },
  { use: 'Fach', rejected: ['Fachgebiet', 'Kategorie'] },
  { use: 'Login-Code', rejected: ['E-Mail-Code'] },
  { use: 'Bestätigungscode', rejected: [] },
] as const
