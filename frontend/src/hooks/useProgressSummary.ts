import { useCallback, useEffect, useState } from 'react'

import { apiClient } from '../api/client'
import type { TopicProgress } from '../api/types'
import type { ProgressSlice } from '../components/ProgressPie'

export const SUBJECT_LABELS: Record<string, string> = {
  navigation: 'Navigation',
  schifffahrtsrecht: 'Schifffahrtsrecht',
  wetterkunde: 'Wetterkunde',
  seemannschaft_allgemein: 'Seemannschaft',
  seemannschaft_motor: 'Seemannschaft (Motor)',
  seemannschaft_segeln: 'Seemannschaft (Segeln)',
}

const CATEGORY_BY_SUBJECT: Record<string, string> = {
  seemannschaft_allgemein: 'seemannschaft',
  seemannschaft_motor: 'seemannschaft',
  seemannschaft_segeln: 'seemannschaft',
}

const CATEGORY_LABELS: Record<string, string> = {
  navigation: 'Navigation',
  schifffahrtsrecht: 'Schifffahrtsrecht',
  wetterkunde: 'Wetterkunde',
  seemannschaft: 'Seemannschaft',
}

// Loads GET /progress/summary once on mount and derives the three views
// the Lernstand UIs need: overall totals, per-category slices (the shared
// and variant-specific Seemannschaft subjects read as one category), and
// topics grouped by subject.
export function useProgressSummary() {
  const [progress, setProgress] = useState<TopicProgress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // No setState before the first `await` here — the initial "loading" state
  // is covered by useState(true) above, not by a synchronous call in the
  // effect body (react-hooks/set-state-in-effect).
  const fetchProgress = useCallback(async () => {
    try {
      const data = await apiClient.get<TopicProgress[]>('/progress/summary')
      setProgress(data)
    } catch {
      setError('Der Lernstand konnte nicht geladen werden.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // Standard fetch-on-mount: no external store for this component-local
    // data, and nothing else ever triggers a second concurrent call, so the
    // stricter "no setState from an effect" pattern doesn't apply here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProgress()
  }, [fetchProgress])

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

  const categoryMap = new Map<string, ProgressSlice>()
  for (const topic of progress) {
    const key = CATEGORY_BY_SUBJECT[topic.subject] ?? topic.subject
    const slice = categoryMap.get(key) ?? { key, label: CATEGORY_LABELS[key] ?? key, learned: 0, total: 0 }
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
  }
}
