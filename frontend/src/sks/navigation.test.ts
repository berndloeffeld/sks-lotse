import { describe, expect, it } from 'vitest'

import { isActive, learnModes, mainNavItems } from './navigation'

describe('mainNavItems', () => {
  it('keeps Lernen and Prüfung side by side without the Kartenaufgaben', () => {
    expect(mainNavItems(false).map((item) => [item.label, item.to])).toEqual([
      ['Lernen', '/learn'],
      ['Probeprüfung', '/exam'],
    ])
  })

  it('splits into the two exam parts with them', () => {
    expect(mainNavItems(true).map((item) => [item.label, item.to, item.icon])).toEqual([
      ['Fragen', '/learn', 'catalog'],
      ['Kartenaufgaben', '/charts', 'charts'],
    ])
  })
})

describe('isActive', () => {
  const [questions, charts] = mainNavItems(true)

  it('matches the path itself and its sub-pages', () => {
    expect(isActive(questions, '/learn')).toBe(true)
    expect(isActive(questions, '/learn/navigation/gezeiten')).toBe(true)
    expect(isActive(questions, '/exam/3')).toBe(true)
    expect(isActive(charts, '/charts/attempts/2')).toBe(true)
  })

  it('does not match a path that only starts with the same letters', () => {
    expect(isActive(questions, '/learning')).toBe(false)
    expect(isActive(questions, '/exam-process')).toBe(false)
    expect(isActive(charts, '/profile')).toBe(false)
  })
})

describe('learnModes', () => {
  it('leaves the Probeprüfung out unless asked for it', () => {
    expect(learnModes(false)).toEqual(['topic', 'focus', 'refresh'])
    expect(learnModes(true)).toEqual(['topic', 'focus', 'refresh', 'exam'])
  })
})
