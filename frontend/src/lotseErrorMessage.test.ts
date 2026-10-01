import { describe, expect, it } from 'vitest'

import { ApiError } from './api/client'
import { lotseErrorMessage } from './lotseErrorMessage'

describe('lotseErrorMessage', () => {
  it.each([
    [429, 'Der Lotse ist für diese Frage oder für heute ausgelastet. Bewerte dich bitte selbst.'],
    [422, 'Diese Antwort kann der Lotse nicht prüfen. Bewerte dich bitte selbst.'],
    [402, 'Deine Tokens sind aufgebraucht. Bewerte dich bitte selbst.'],
    [503, 'Der Lotse ist gerade nicht erreichbar. Bewerte dich bitte selbst.'],
  ])('explains a %i', (status, message) => {
    expect(lotseErrorMessage(new ApiError(status, 'x'))).toBe(message)
  })

  it('falls back for anything that is not an API error', () => {
    expect(lotseErrorMessage(new Error('network'))).toBe(
      'Der Lotse ist gerade nicht erreichbar. Bewerte dich bitte selbst.',
    )
  })
})
