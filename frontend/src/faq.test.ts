import { describe, expect, it } from 'vitest'

import { FAQ, faqAnswerParts } from './faq'

describe('FAQ', () => {
  it('gives every entry a non-empty question, answer, and unique id', () => {
    const ids = FAQ.map((entry) => entry.id)

    expect(ids).toHaveLength(new Set(ids).size)
    for (const { id, question, answer } of FAQ) {
      expect(id).toMatch(/^[a-z-]+$/)
      expect(question.length).toBeGreaterThan(0)
      expect(answer.length).toBeGreaterThan(0)
    }
  })
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

  it('writes page references as links, never as bare paths or "in der Fußzeile"', () => {
    for (const { answer } of FAQ) {
      const text = faqAnswerParts(answer)
        .filter((part) => !part.to)
        .map((part) => part.text)
        .join('')
      expect(text).not.toMatch(/\(\/|Fußzeile|\]\(/)
    }
    const links = FAQ.flatMap(({ answer }) => faqAnswerParts(answer).filter((part) => part.to))
    expect(links.map((part) => part.to)).toEqual(expect.arrayContaining(['/pricing', '/exam-process', '/privacy']))
  })
})
