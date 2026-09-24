import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { trackEvent } from '../analytics'
import { apiClient } from '../api/client'
import type { TopicProgress } from '../api/types'
import { useProgressSummary } from './useProgressSummary'

vi.mock('../api/client', () => ({ apiClient: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
vi.mock('../analytics', () => ({ trackEvent: vi.fn() }))

const get = vi.mocked(apiClient.get)
const put = vi.mocked(apiClient.put)
const del = vi.mocked(apiClient.delete)

function topic(overrides: Partial<TopicProgress>): TopicProgress {
  return {
    subject: 'navigation',
    topic_slug: 'kurs',
    topic_name: 'Kurs',
    display_order: 1,
    total_questions: 10,
    learned_questions: 4,
    learning_questions: 2,
    is_focus: false,
    ...overrides,
  }
}

const TOPICS = [
  topic({ subject: 'navigation', topic_slug: 'a', total_questions: 10, learned_questions: 4, is_focus: true }),
  topic({ subject: 'navigation', topic_slug: 'b', total_questions: 6, learned_questions: 1 }),
  topic({
    subject: 'seemannschaft_allgemein',
    topic_slug: 'c',
    total_questions: 8,
    learned_questions: 3,
    learning_questions: 1,
    is_focus: true,
  }),
  topic({ subject: 'seemannschaft_motor', topic_slug: 'd', total_questions: 5, learned_questions: 2 }),
  topic({ subject: 'wetterkunde', topic_slug: 'e', total_questions: 3, learned_questions: 0 }),
]

async function load(topics: TopicProgress[] = TOPICS) {
  get.mockResolvedValue(topics)
  const hook = renderHook(() => useProgressSummary())
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false))
  return hook
}

describe('useProgressSummary', () => {
  beforeEach(() => {
    get.mockReset()
    put.mockReset().mockResolvedValue(undefined)
    del.mockReset().mockResolvedValue(undefined)
    vi.mocked(trackEvent).mockReset()
  })

  it('is loading until GET /progress/summary resolves', async () => {
    get.mockResolvedValue([])
    const { result } = renderHook(() => useProgressSummary())
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(get).toHaveBeenCalledWith('/progress/summary')
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('reports an error when the summary cannot be loaded', async () => {
    get.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useProgressSummary())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBe('Der Lernstand konnte nicht geladen werden.')
  })

  it('sums the overall totals', async () => {
    const { result } = await load()
    expect(result.current.totals).toEqual({ learned: 10, total: 32 })
  })

  it('groups topics by subject in the delivered order', async () => {
    const { result } = await load()
    const { bySubject } = result.current
    expect([...bySubject.keys()]).toEqual([
      'navigation',
      'seemannschaft_allgemein',
      'seemannschaft_motor',
      'wetterkunde',
    ])
    expect(bySubject.get('navigation')?.map((t) => t.topic_slug)).toEqual(['a', 'b'])
  })

  it('merges the Seemannschaft subjects into one category and labels the others', async () => {
    const { result } = await load()
    expect(result.current.categories).toEqual([
      { key: 'navigation', label: 'Navigation', learned: 5, total: 16 },
      { key: 'seemannschaft', label: 'Seemannschaft', learned: 5, total: 13 },
      { key: 'wetterkunde', label: 'Wetterkunde', learned: 0, total: 3 },
    ])
  })

  it('counts the Segeln-only Seemannschaft subject into the same category', async () => {
    const { result } = await load([
      topic({ subject: 'seemannschaft_allgemein', total_questions: 4, learned_questions: 1 }),
      topic({ subject: 'seemannschaft_segeln', total_questions: 3, learned_questions: 2 }),
    ])
    expect(result.current.categories).toEqual([{ key: 'seemannschaft', label: 'Seemannschaft', learned: 3, total: 7 }])
  })

  it('labels the Schifffahrtsrecht category and falls back to the key for an unknown subject', async () => {
    const { result } = await load([
      topic({ subject: 'schifffahrtsrecht', total_questions: 2, learned_questions: 1 }),
      topic({ subject: 'unbekannt', total_questions: 1, learned_questions: 1 }),
    ])
    expect(result.current.categories).toEqual([
      { key: 'schifffahrtsrecht', label: 'Schifffahrtsrecht', learned: 1, total: 2 },
      { key: 'unbekannt', label: 'unbekannt', learned: 1, total: 1 },
    ])
  })

  it('collects the Fokus topics with their combined counts', async () => {
    const { result } = await load()
    expect(result.current.focusTopics.map((t) => t.topic_slug)).toEqual(['a', 'c'])
    expect(result.current.focusTotals).toEqual({ learned: 7, learning: 3, total: 18 })
  })

  it('toggleFocus marks a topic (PUT), tracks it and reloads the summary', async () => {
    const { result } = await load()

    await act(() => result.current.toggleFocus(TOPICS[1]))

    expect(put).toHaveBeenCalledWith('/progress/focus/navigation/b')
    expect(del).not.toHaveBeenCalled()
    expect(trackEvent).toHaveBeenCalledWith('focus_set')
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('toggleFocus unmarks a Fokus topic (DELETE) without tracking', async () => {
    const { result } = await load()

    await act(() => result.current.toggleFocus(TOPICS[0]))

    expect(del).toHaveBeenCalledWith('/progress/focus/navigation/a')
    expect(put).not.toHaveBeenCalled()
    expect(trackEvent).not.toHaveBeenCalled()
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('a failed toggle sets focusError, keeps the summary and skips the reload; the next attempt clears it', async () => {
    const { result } = await load()
    put.mockRejectedValueOnce(new Error('409'))

    await act(() => result.current.toggleFocus(TOPICS[1]))
    expect(result.current.focusError).toBe('Der Fokus konnte nicht gespeichert werden.')
    expect(result.current.error).toBeNull()
    expect(trackEvent).not.toHaveBeenCalled()
    expect(get).toHaveBeenCalledTimes(1)

    await act(() => result.current.toggleFocus(TOPICS[1]))
    expect(result.current.focusError).toBeNull()
  })
})
