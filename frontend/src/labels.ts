import type { ExamVariant } from './api/types'

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
