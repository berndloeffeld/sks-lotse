import { describe, expect, it } from 'vitest'

import {
  formatDate,
  formatDateTime,
  formatEurCents,
  getDisplayName,
  getFullName,
  percentOf,
  formatDecimal,
  formatPercent,
  formatPercentOf,
  pluralize,
} from './format'

describe('percentOf', () => {
  it('rounds to a whole percentage', () => {
    expect(percentOf(1, 3)).toBe(33)
    expect(percentOf(2, 3)).toBe(67)
  })

  it('is 0 for an empty total', () => {
    expect(percentOf(0, 0)).toBe(0)
  })
})

describe('getFullName', () => {
  it('joins first and last name', () => {
    expect(getFullName({ first_name: 'Anna', last_name: 'Beispiel' })).toBe('Anna Beispiel')
  })

  it('uses whichever part is set, without stray spaces', () => {
    expect(getFullName({ first_name: 'Anna', last_name: null })).toBe('Anna')
    expect(getFullName({ first_name: null, last_name: 'Beispiel' })).toBe('Beispiel')
  })

  it("is '' when neither is set", () => {
    expect(getFullName({ first_name: null, last_name: null })).toBe('')
  })
})

describe('getDisplayName', () => {
  it('prefers the name', () => {
    expect(getDisplayName({ first_name: 'Anna', last_name: null, email: 'a@example.com' })).toBe('Anna')
  })

  it('falls back to the email', () => {
    expect(getDisplayName({ first_name: null, last_name: null, email: 'a@example.com' })).toBe('a@example.com')
  })
})

describe('formatDate', () => {
  it('formats as a German medium date', () => {
    expect(formatDate('2026-09-19T12:05:00Z')).toMatch(/^\d{2}\.\d{2}\.\d{4}$/)
  })
})

describe('formatDateTime', () => {
  it('formats as German medium date and short time, without seconds', () => {
    // The exact digits depend on the machine's time zone; the shape doesn't.
    expect(formatDateTime('2026-09-19T12:05:00Z')).toMatch(/^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/)
  })
})

describe('formatEurCents', () => {
  it('formats cents as a German euro amount', () => {
    expect(formatEurCents(299)).toBe('2,99 €')
    expect(formatEurCents(500)).toBe('5,00 €')
  })

  it('formats a round number of euros with two decimals', () => {
    expect(formatEurCents(1699)).toBe('16,99 €')
  })
})

describe('German number formats', () => {
  it('writes percentages with a no-break space', () => {
    expect(formatPercent(0.54)).toBe('54 %')
    expect(formatPercentOf(1, 3)).toBe('33 %')
    expect(formatPercentOf(1, 0)).toBe('0 %')
  })

  it('writes decimals with a comma and drops a whole fraction', () => {
    expect(formatDecimal(37.5)).toBe('37,5')
    expect(formatDecimal(38)).toBe('38')
    expect(formatDecimal(1.256, 2)).toBe('1,26')
  })

  it('picks singular only for exactly one', () => {
    expect(pluralize(1, 'Token', 'Tokens')).toBe('1 Token')
    expect(pluralize(0, 'Token', 'Tokens')).toBe('0 Tokens')
    expect(pluralize(5, 'Token', 'Tokens')).toBe('5 Tokens')
  })
})
