import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '../store/authStore'
import { jsonResponse, makeChartOverview } from '../test/fixtures'
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
