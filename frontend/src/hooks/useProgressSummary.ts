import { useCallback, useState } from 'react'

import { trackEvent } from '../analytics'
import { apiClient } from '../api/client'
import type { TopicProgress } from '../api/types'
import type { ProgressSlice } from '../components/ProgressPie'
import { SUBJECT_GROUP_LABELS } from '../labels'
import { useApiQuery } from './useApiQuery'

const CATEGORY_BY_SUBJECT: Record<string, string> = {
  seemannschaft_allgemein: 'seemannschaft',
  seemannschaft_motor: 'seemannschaft',
  seemannschaft_segeln: 'seemannschaft',
}

// Loads GET /progress/summary once on mount and derives the three views
// the Lernstand UIs need: overall totals, per-category slices (the shared
// and variant-specific Seemannschaft subjects read as one category), and
// topics grouped by subject, plus the Fokus topics with their combined
// counts and the toggle that marks/unmarks one.
export function useProgressSummary() {
  const {
    data,
    isLoading,
    failed,
    reload: fetchProgress,
  } = useApiQuery('progress-summary', () => apiClient.get<TopicProgress[]>('/progress/summary'))
  const progress = data ?? []
  const error = failed ? 'Der Lernstand konnte nicht geladen werden.' : null
  // Separate from `error`: a failed mark/unmark must not replace the whole
  // Lernstand with an error message.
  const [focusError, setFocusError] = useState<string | null>(null)

  // Marks or unmarks a topic as Fokus, then reloads the summary so every
  // derived view (Fokus band, stars) reflects the server's state — which also
  // covers the server refusing a mark (409, topic already fully learned).
  const toggleFocus = useCallback(
    async (topic: TopicProgress) => {
      const path = `/progress/focus/${topic.subject}/${topic.topic_slug}`
      setFocusError(null)
      try {
        await (topic.is_focus ? apiClient.delete(path) : apiClient.put(path))
        if (!topic.is_focus) trackEvent('focus_set')
      } catch {
        setFocusError('Der Fokus konnte nicht gespeichert werden.')
        return
      }
      await fetchProgress()
    },
    [fetchProgress],
  )

  // /progress/summary is already ordered by (subject, display_order) —
  // grouping via Map preserves that order.
  const bySubject = new Map<string, TopicProgress[]>()
  for (const topic of progress) {
    const topics = bySubject.get(topic.subject) ?? []
    topics.push(topic)
    bySubject.set(topic.subject, topics)
  }

  const totals = progress.reduce(
    (acc, topic) => ({
      learned: acc.learned + topic.learned_questions,
      total: acc.total + topic.total_questions,
    }),
    { learned: 0, total: 0 },
  )

  const focusTopics = progress.filter((topic) => topic.is_focus)
  const focusTotals = focusTopics.reduce(
    (acc, topic) => ({
      learned: acc.learned + topic.learned_questions,
      learning: acc.learning + topic.learning_questions,
      total: acc.total + topic.total_questions,
    }),
    { learned: 0, learning: 0, total: 0 },
  )

  const categoryMap = new Map<string, ProgressSlice>()
  for (const topic of progress) {
    const key = CATEGORY_BY_SUBJECT[topic.subject] ?? topic.subject
    const slice = categoryMap.get(key) ?? { key, label: SUBJECT_GROUP_LABELS[key] ?? key, learned: 0, total: 0 }
    slice.learned += topic.learned_questions
    slice.total += topic.total_questions
    categoryMap.set(key, slice)
  }

  return {
    progress,
    isLoading,
    error,
    totals,
    categories: Array.from(categoryMap.values()),
    bySubject,
    focusTopics,
    focusTotals,
    toggleFocus,
    focusError,
  }
}
