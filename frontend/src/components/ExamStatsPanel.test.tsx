import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import type { ExamStats } from '../api/types'
import { jsonResponse } from '../test/examFixtures'
import { ExamStatsPanel } from './ExamStatsPanel'

const stats: ExamStats = {
  completed_count: 2,
  passed_count: 1,
  average_points: 42.5,
  best_points: 45,
  max_points: 60,
  recent: [
    { exam_id: 1, submitted_at: '2026-09-01T11:00:00Z', points: 40, result: 'bestanden' },
    { exam_id: 2, submitted_at: '2026-09-02T11:00:00Z', points: 30, result: 'nicht_bestanden' },
  ],
  group_scores: [
    { subject_group: 'navigation', points: 20, max_points: 36 },
    { subject_group: 'seemannschaft', points: 10, max_points: 36 },
  ],
}

function renderPanel() {
  return render(
    <MemoryRouter>
      <ExamStatsPanel />
    </MemoryRouter>,
  )
}

describe('ExamStatsPanel', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('summarises completed exams', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(stats)),
    )
    renderPanel()
    expect(await screen.findByText('42,5 / 60')).toBeInTheDocument()
    expect(screen.getByText('1 (50 %)')).toBeInTheDocument()
    expect(screen.getByText('45 / 60')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /40 von 60 Punkten/ })).toHaveAttribute('href', '/exam/1')
    expect(screen.getByText('Navigation')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Alle Prüfungen/ })).toHaveAttribute('href', '/exam')
  })

  it('says so when no exam is complete yet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          ...stats,
          completed_count: 0,
          passed_count: 0,
          average_points: null,
          best_points: null,
          recent: [],
        }),
      ),
    )
    renderPanel()
    expect(await screen.findByText('Noch keine Prüfung abgeschlossen.')).toBeInTheDocument()
  })

  it('reports a failed load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ detail: 'x' }, 500)),
    )
    renderPanel()
    expect(await screen.findByText('Die Prüfungsstatistik konnte nicht geladen werden.')).toBeInTheDocument()
  })
})
