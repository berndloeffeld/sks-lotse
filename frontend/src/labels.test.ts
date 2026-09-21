import { describe, expect, it } from 'vitest'

import { EXAM_RESULT_LABELS, GENDER_LABELS, SUBJECT_GROUP_LABELS, VARIANT_LABELS } from './labels'

// The learner-facing wording is a contract (also used by the admin view), so
// changing it should be a deliberate edit here too.
describe('labels', () => {
  it('names the exam variants', () => {
    expect(VARIANT_LABELS).toEqual({ segeln_und_motor: 'Motor und Segeln', motor: 'Motor' })
  })

  it('names the genders', () => {
    expect(GENDER_LABELS).toEqual({ maennlich: 'Männlich', weiblich: 'Weiblich', divers: 'Divers' })
  })

  it('names the subject groups', () => {
    expect(SUBJECT_GROUP_LABELS).toEqual({
      navigation: 'Navigation',
      schifffahrtsrecht: 'Schifffahrtsrecht',
      wetterkunde: 'Wetterkunde',
      seemannschaft: 'Seemannschaft',
    })
  })

  it('names the exam results', () => {
    expect(EXAM_RESULT_LABELS).toEqual({
      bestanden: 'Bestanden',
      muendliche_nachpruefung: 'Mündliche Nachprüfung erforderlich',
      nicht_bestanden: 'Nicht bestanden',
    })
  })
})
