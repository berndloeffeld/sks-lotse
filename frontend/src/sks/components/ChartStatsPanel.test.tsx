import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import type { ChartStats } from '../api/types'
import { jsonResponse } from '../../test/fixtures'
import { ChartStatsPanel } from './ChartStatsPanel'

const sheet = { max_points: 30, completed_count: 0, last_points: null, best_points: null, last_result: null }

const stats: ChartStats = {
  completed_count: 3,
  passed_count: 1,
  average_points: 18.3,
  best_points: 22,
  max_points: 30,
  runs: [
    { attempt_id: 11, exercise_number: 1, completed_at: '2026-10-30T09:00:00Z', points: 14, result: 'nicht_bestanden' },
    // Two sheets on the same day: two bars with the same date.
    {
      attempt_id: 12,
      exercise_number: 3,
      completed_at: '2026-10-30T13:00:00Z',
      points: 18,
      result: 'muendliche_nachpruefung',
    },
    { attempt_id: 13, exercise_number: 1, completed_at: '2026-10-31T13:00:00Z', points: 22, result: 'bestanden' },
  ],
  sheets: [
    {
      ...sheet,
      number: 1,
      title: 'Cuxhaven → Büsum',
      completed_count: 2,
      last_points: 22,
      best_points: 22,
      last_result: 'bestanden',
    },
    { ...sheet, number: 2, title: 'Helgoland' },
  ],
}

function renderPanel(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse(body, status)),
  )
  return render(
    <MemoryRouter>
      <ChartStatsPanel />
    </MemoryRouter>,
  )
}

describe('ChartStatsPanel', () => {
  it('summarises the completed runs', async () => {
    renderPanel(stats)
    expect(await screen.findByText('18,3 / 30')).toBeInTheDocument()
    expect(screen.getByText(/^1 \(33\s%\)$/)).toBeInTheDocument()
    expect(screen.getByText('22 / 30')).toBeInTheDocument()
  })

  it('draws one bar per run, linked to the run, coloured by its verdict', async () => {
    renderPanel(stats)
    const timeline = await screen.findByRole('list', { name: 'Ergebnisse der Kartenaufgaben' })
    const bars = within(timeline).getAllByRole('link')
    expect(bars.map((bar) => bar.getAttribute('href'))).toEqual([
      '/charts/attempts/11',
      '/charts/attempts/12',
      '/charts/attempts/13',
    ])
    expect(bars[1]).toHaveAccessibleName(/Blatt 3, 18 von 30 Punkten, Mündliche Nachprüfung erforderlich/)
    expect(bars[1].firstElementChild).toHaveClass('bg-accent')
    expect(bars[1].firstElementChild).toHaveStyle({ height: '60%' })
    expect(bars[2].firstElementChild).toHaveClass('bg-success')
    expect(bars[0].firstElementChild).toHaveClass('bg-danger')
  })

  it('places the bars to scale in time, runs of one day side by side in its slot', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-01T12:00:00Z'), toFake: ['Date'] })
    renderPanel(stats)
    const timeline = await screen.findByRole('list', { name: 'Ergebnisse der Kartenaufgaben' })
    vi.useRealTimers()
    // 30.10. to 01.11.: three days, a third each; the 30.10. holds two runs.
    const [first, second, third] = within(timeline).getAllByRole('listitem')
    const width = (item: HTMLElement) => parseFloat(item.style.width)
    const left = (item: HTMLElement) => parseFloat(item.style.left)
    expect(width(first)).toBeCloseTo(100 / 6)
    expect(left(first)).toBe(0)
    expect(left(second)).toBeCloseTo(100 / 6)
    expect(width(third)).toBeCloseTo(100 / 3)
    expect(left(third)).toBeCloseTo(100 / 3)
    expect(screen.getByText('heute')).toBeInTheDocument()
  })

  it('lists every sheet, with a link to start the ones not worked on yet', async () => {
    renderPanel(stats)
    expect(await screen.findByText('letzte 22 · beste 22')).toBeInTheDocument()
    expect(screen.getByText('2×')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Bestanden' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /noch nicht gerechnet/ })).toHaveAttribute('href', '/charts/2')
  })

  it('says so when no run is completed yet', async () => {
    renderPanel({ ...stats, completed_count: 0, runs: [], sheets: [] })
    expect(await screen.findByText('Noch keine Kartenaufgabe abgeschlossen.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Ergebnisse der Kartenaufgaben' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Alle Kartenaufgaben ansehen/ })).toHaveAttribute('href', '/charts')
  })

  it('shows an error when the statistics fail to load', async () => {
    renderPanel({ detail: 'boom' }, 500)
    expect(await screen.findByText('Die Statistik der Kartenaufgaben konnte nicht geladen werden.')).toBeInTheDocument()
  })
})
