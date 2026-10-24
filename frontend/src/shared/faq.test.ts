import { describe, expect, it } from 'vitest'

import { faqAnswerParts } from './faq'

describe('faqAnswerParts', () => {
  it('splits an answer into text and site-relative links', () => {
    expect(faqAnswerParts('Siehe [Preise](/pricing) und [Ablauf](/exam-process#sbf).')).toEqual([
      { text: 'Siehe ' },
      { text: 'Preise', to: '/pricing' },
      { text: ' und ' },
      { text: 'Ablauf', to: '/exam-process#sbf' },
      { text: '.' },
    ])
    expect(faqAnswerParts('[Profil](/profile)')).toEqual([{ text: 'Profil', to: '/profile' }])
    expect(faqAnswerParts('Nur Text.')).toEqual([{ text: 'Nur Text.' }])
  })

  it('leaves anything that is not a site-relative link as text', () => {
    expect(faqAnswerParts('[extern](https://example.com) (/exam-process) [leer]()')).toEqual([
      { text: '[extern](https://example.com) (/exam-process) [leer]()' },
    ])
  })
})
