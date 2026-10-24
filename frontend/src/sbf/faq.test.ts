import { describe, expect, it } from 'vitest'

import { faqAnswerParts } from '../shared/faq'
import { sbfFaq } from './faq'

describe('sbfFaq', () => {
  it('describes the site as being built while the Navigationsaufgaben are off', () => {
    const faq = sbfFaq(false)
    expect(faq[0].answer).toContain('Sie ist im Aufbau. Als Erstes kommen')
    expect(faq.map((entry) => entry.id)).not.toContain('toleranz')
    expect(faq.map((entry) => entry.id)).toEqual(['was', 'navigationsaufgabe', 'quelle', 'konto', 'kosten', 'sks'])
  })

  it('links the Navigationsaufgaben and explains the own tolerances once they are on', () => {
    const faq = sbfFaq(true)
    expect(faqAnswerParts(faq[0].answer)).toContainEqual({ text: 'Navigationsaufgaben', to: '/navigation' })
    expect(faq.map((entry) => entry.id)).toEqual([
      'was',
      'navigationsaufgabe',
      'quelle',
      'toleranz',
      'konto',
      'kosten',
      'sks',
    ])
    expect(faq.find((entry) => entry.id === 'toleranz')?.answer).toContain('nicht amtlich')
  })

  it('says what an account and the Lotsen-Check bring once accounts are on (ADR-0071)', () => {
    const faq = sbfFaq(true, true)
    expect(faq.map((entry) => entry.id)).toEqual([
      'was',
      'navigationsaufgabe',
      'quelle',
      'toleranz',
      'konto',
      'kosten',
      'sks',
    ])
    expect(faq.find((entry) => entry.id === 'konto')?.answer).toContain(
      'Hast du ein Konto bei SKS Lotse, gilt es auch hier.',
    )
    const cost = faq.find((entry) => entry.id === 'kosten')!.answer
    expect(cost).toContain('2 je Teilaufgabe')
    expect(faqAnswerParts(cost)).toContainEqual({ text: 'Preise', to: '/pricing' })
    expect(sbfFaq(true, false).find((entry) => entry.id === 'konto')?.answer).toContain('kommen später')
  })
})
