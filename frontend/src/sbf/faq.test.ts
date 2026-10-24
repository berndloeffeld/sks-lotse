import { describe, expect, it } from 'vitest'

import { faqAnswerParts } from '../faq'
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
})
