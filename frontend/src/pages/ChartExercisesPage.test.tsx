import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { primeChartCatalog, resetChartCatalog } from '../chartCatalog'
import { useAuthStore } from '../store/authStore'
import { jsonResponse, makeChartExport, makeChartOverview } from '../test/fixtures'
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

    const first = await screen.findByRole('link', { name: /Kartenaufgabe 1/ })
    expect(first).toHaveAttribute('href', '/charts/1')
    expect(within(first).getByText('Noch nicht bearbeitet')).toBeInTheDocument()
    expect(within(screen.getByRole('link', { name: /Kartenaufgabe 2/ })).getByText('Begonnen')).toBeInTheDocument()
    expect(
      within(screen.getByRole('link', { name: /Kartenaufgabe 3/ })).getByText('Zuletzt 24 / 30 Punkte'),
    ).toBeInTheDocument()
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
    expect(within(first).getByText('2 Aufgaben · 3 Punkte')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mit einem Konto' })).toHaveAttribute('href', '/login')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('loads the export when it is not there yet', async () => {
    vi.stubGlobal('fetch', vi.fn())
    renderPage()

    expect(screen.getByText('Wird geladen…')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Kartenaufgabe 1/ })).toBeInTheDocument()
  })
})
