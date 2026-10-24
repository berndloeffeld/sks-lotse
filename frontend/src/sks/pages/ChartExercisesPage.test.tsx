import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { primeChartCatalog, resetChartCatalog } from '../chartCatalog'
import { useAuthStore } from '../store/authStore'
import { jsonResponse, makeChartExport, makeChartOverview } from '../../test/fixtures'
import { ChartExercisesPage } from './ChartExercisesPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <ChartExercisesPage />
    </MemoryRouter>,
  )
}

describe('ChartExercisesPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: true, isLoading: false })
  })

  it('lists the exercises with where the learner stands in each', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(makeChartOverview())),
    )
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'SKS-Kartenaufgaben' })).toBeInTheDocument()
    const first = await screen.findByRole('link', { name: /Kartenaufgabe 1/ })
    expect(first).toHaveAttribute('href', '/charts/1')
    expect(within(first).getByRole('heading', { name: 'Cuxhaven → Büsum' })).toBeInTheDocument()
    expect(within(first).getByText('Elbabwärts durch die Norderrinne.')).toBeInTheDocument()
    expect(first).toHaveTextContent('18 Aufgaben · 30 Punkte')
    expect(first).toHaveTextContent('Noch nicht bearbeitet')
    expect(screen.getByRole('link', { name: /Kartenaufgabe 2/ })).toHaveTextContent('Begonnen')
    expect(screen.getByRole('link', { name: /Kartenaufgabe 3/ })).toHaveTextContent('Zuletzt 24 / 30 Punkte')
  })

  it('shows the sheets still to come as tiles that are not links', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(makeChartOverview())),
    )
    renderPage()

    await screen.findByRole('link', { name: /Kartenaufgabe 3/ })
    for (const [number, tour] of [
      [8, 'Großtonne GB → Cuxhaven'],
      [9, 'Wurster Watt → Neuwerk'],
      [10, 'Cuxhaven → Spiekeroog'],
    ] as const) {
      expect(screen.getByText(`Kartenaufgabe ${number}`)).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: tour })).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: new RegExp(`Kartenaufgabe ${number}`) })).not.toBeInTheDocument()
    }
    expect(screen.getAllByText('Bald verfügbar')).toHaveLength(3)
  })

  it('says so when the exercises cannot be loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ detail: 'down' }, 500)),
    )
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Kartenaufgaben konnten nicht geladen werden.')
    expect(screen.queryByText('Wird geladen…')).not.toBeInTheDocument()
  })
})

describe('ChartExercisesPage for a guest', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: false, isLoading: false, user: null })
  })
  afterEach(() => resetChartCatalog())

  it('lists the sheets from the export, without asking the API', () => {
    primeChartCatalog(makeChartExport())
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    renderPage()

    const first = screen.getByRole('link', { name: /Kartenaufgabe 1/ })
    expect(first).toHaveAttribute('href', '/charts/1')
    expect(within(first).getByRole('heading', { name: 'Cuxhaven → Büsum' })).toBeInTheDocument()
    expect(first).toHaveTextContent('2 Aufgaben · 3 Punkte')
    expect(first).not.toHaveTextContent('Noch nicht bearbeitet')
    expect(screen.getByRole('link', { name: 'Kostenlos anmelden' })).toHaveAttribute('href', '/login')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows the sheets still to come, also for a guest', () => {
    primeChartCatalog(makeChartExport())
    vi.stubGlobal('fetch', vi.fn())
    renderPage()

    expect(screen.getByRole('heading', { name: 'Wurster Watt → Neuwerk' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Kartenaufgabe 9/ })).not.toBeInTheDocument()
    expect(screen.getAllByText('Bald verfügbar')).toHaveLength(3)
  })

  it('loads the export when it is not there yet', async () => {
    vi.stubGlobal('fetch', vi.fn())
    renderPage()

    expect(screen.getByText('Wird geladen…')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Kartenaufgabe 1/ })).toBeInTheDocument()
  })
})
