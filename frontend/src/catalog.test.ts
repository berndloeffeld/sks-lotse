import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  catalogSnapshot,
  findTopic,
  loadCatalog,
  primeCatalog,
  resetCatalog,
  toGuestCatalog,
  topicQuestions,
  topicsBySubject,
  type CatalogExport,
} from './catalog'

const EXPORT: CatalogExport = {
  topics: [
    { subject: 'navigation', slug: 'seekarten', name: 'Seekarten', display_order: 1 },
    { subject: 'navigation', slug: 'gezeiten', name: 'Gezeiten', display_order: 2 },
    { subject: 'wetterkunde', slug: 'wind', name: 'Wind', display_order: 1 },
  ],
  questions: [
    {
      subject: 'navigation',
      number: 7,
      topic: 'seekarten',
      question_text: 'F7',
      answer_text: 'A7',
      question_images: [],
      answer_images: [],
    },
    {
      subject: 'navigation',
      number: 9,
      topic: 'gezeiten',
      question_text: 'F9',
      answer_text: 'A9',
      question_images: [],
      answer_images: [],
    },
    {
      subject: 'wetterkunde',
      number: 7,
      topic: 'wind',
      question_text: 'W7',
      answer_text: 'B7',
      question_images: [],
      answer_images: [],
    },
  ],
}

describe('catalog', () => {
  afterEach(() => resetCatalog())

  it('gives every guest question a unique negative stand-in id', () => {
    expect(toGuestCatalog(EXPORT).questions.map((q) => q.id)).toEqual([-1, -2, -3])
    expect(toGuestCatalog(EXPORT).questions[0]).toMatchObject({ subject: 'navigation', number: 7, question_text: 'F7' })
  })

  it('has no snapshot until primed or loaded', async () => {
    expect(catalogSnapshot()).toBeNull()
    const primed = primeCatalog(EXPORT)
    expect(catalogSnapshot()).toBe(primed)
    expect(await loadCatalog(() => Promise.reject(new Error('not needed')))).toBe(primed)
  })

  it('loads once, shares the pending load, and retries after a failure', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(EXPORT)

    await expect(loadCatalog(load)).rejects.toThrow('offline')
    expect(catalogSnapshot()).toBeNull()

    const [first, second] = await Promise.all([loadCatalog(load), loadCatalog(load)])
    expect(first).toBe(second)
    expect(load).toHaveBeenCalledTimes(2)
    expect(catalogSnapshot()).toBe(first)
  })

  it('groups topics by subject in the given order and finds a topic and its questions', () => {
    const catalog = toGuestCatalog(EXPORT)

    expect([...topicsBySubject(catalog.topics)].map(([subject, ts]) => [subject, ts.map((t) => t.slug)])).toEqual([
      ['navigation', ['seekarten', 'gezeiten']],
      ['wetterkunde', ['wind']],
    ])
    expect(findTopic(catalog, 'navigation', 'gezeiten')?.name).toBe('Gezeiten')
    expect(findTopic(catalog, 'wetterkunde', 'gezeiten')).toBeUndefined()
    expect(topicQuestions(catalog, 'navigation', 'seekarten').map((q) => q.number)).toEqual([7])
    expect(topicQuestions(catalog, 'wetterkunde', 'seekarten')).toEqual([])
  })

  it('loads the real export by default', async () => {
    const catalog = await loadCatalog()
    expect(catalog.topics.length).toBeGreaterThan(20)
    expect(catalog.questions.length).toBeGreaterThan(500)
  })
})
