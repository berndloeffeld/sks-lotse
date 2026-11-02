import { describe, expect, it } from 'vitest'

import { loginState, safeReturnPath } from './returnPath'

const at = (pathname: string, search = '', hash = '') => ({ pathname, search, hash })

describe('loginState', () => {
  it('carries the page the login was asked for from, with its query and anchor', () => {
    expect(loginState(at('/pricing'))).toEqual({ from: '/pricing' })
    expect(loginState(at('/learn', '?modus=focus', '#top'))).toEqual({ from: '/learn?modus=focus#top' })
  })

  it('carries nothing from the landing page or the login itself', () => {
    expect(loginState(at('/'))).toEqual({})
    expect(loginState(at('/login', '?x=1'))).toEqual({})
  })
})

describe('safeReturnPath', () => {
  it.each(['/pricing', '/exam/12', '/charts/attempts/5', '/learn?modus=focus', '/faq#frage'])(
    'returns to the internal path %s',
    (from) => {
      expect(safeReturnPath({ from })).toBe(from)
    },
  )

  it.each([
    ['another host, protocol-relative', '//evil.example'],
    ['another host behind three slashes', '///evil.example'],
    ['an absolute URL', 'https://evil.example'],
    ['a scheme with one slash', 'http:/evil.example'],
    ['a backslash the browser takes for a slash', '/\\evil.example'],
    ['two backslashes', '\\\\evil.example'],
    ['a tab the browser drops', '/\t/evil.example'],
    ['a line break the browser drops', '/\n/evil.example'],
    ['a dot segment that leaves "//" behind', '/.//evil.example'],
    ['a dot-dot segment that leaves "//" behind', '/a/..//evil.example'],
    ['an encoded dot segment', '/%2e//evil.example'],
    ['a leading space', ' /evil'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a relative path', 'pricing'],
    ['an empty string', ''],
  ])('falls back to /learn for %s', (_, from) => {
    expect(safeReturnPath({ from })).toBe('/learn')
  })

  it.each([
    ['no state', null],
    ['undefined', undefined],
    ['a string state', '/pricing'],
    ['a number', 42],
    ['a state without from', {}],
    ['a non-string from', { from: 42 }],
  ])('falls back to /learn for %s', (_, state) => {
    expect(safeReturnPath(state)).toBe('/learn')
  })

  it('does not send the learner back to the login or the landing page', () => {
    expect(safeReturnPath({ from: '/login' })).toBe('/learn')
    expect(safeReturnPath({ from: '/login?next=1' })).toBe('/learn')
    expect(safeReturnPath({ from: '/' })).toBe('/learn')
  })

  it('returns the path as the browser reads it', () => {
    expect(safeReturnPath({ from: '/learn/./navigation/../meteorologie' })).toBe('/learn/meteorologie')
  })
})
