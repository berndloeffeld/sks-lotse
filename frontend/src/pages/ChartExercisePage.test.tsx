import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '../store/authStore'
import { jsonResponse, makeChartAttempt, makeChartOverview } from '../test/fixtures'
import { ChartExercisePage } from './ChartExercisePage'

function renderPage(number: string) {
  return render(
    <MemoryRouter initialEntries={[`/charts/${number}`]}>
      <Routes>
        <Route path="/charts/:number" element={<ChartExercisePage />} />
        <Route path="/charts/attempts/:id" element={<p>Run page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function stubBackend(start: () => Response = () => jsonResponse(makeChartAttempt({ id: 42 }), 201)) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'POST' ? start() : jsonResponse(makeChartOverview()),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('ChartExercisePage', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: true, isLoading: false })
  })

  it('makes clear that chart, handbook and tools are the learner’s own', async () => {
    stubBackend()
    renderPage('1')

    const own = await screen.findByRole('region', { name: 'Das brauchst du selbst' })
    expect(own).toHaveTextContent('nicht Teil von SKS Lotse')
    expect(own).toHaveTextContent('Übungskarte 49 (INT 1463)')
    expect(own).toHaveTextContent('Navigationsbesteck')
  })

  it('starts only once the learner confirms having everything ready', async () => {
    const user = userEvent.setup()
    const fetchMock = stubBackend()
    renderPage('1')

    await user.click(await screen.findByRole('button', { name: 'Kartenaufgabe starten' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Bestätige zuerst')
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/attempts'), expect.anything())

    await user.click(screen.getByRole('checkbox', { name: /bereitgelegt/ }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Kartenaufgabe starten' }))

    expect(await screen.findByText('Run page')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/chart-exercises/1/attempts'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('explains a run that is already open', async () => {
    const user = userEvent.setup()
    stubBackend(() => jsonResponse({ detail: 'in progress' }, 409))
    renderPage('1')

    await user.click(await screen.findByRole('checkbox', { name: /bereitgelegt/ }))
    await user.click(screen.getByRole('button', { name: 'Kartenaufgabe starten' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Diese Kartenaufgabe läuft bereits.')
  })

  it('reports other start failures', async () => {
    const user = userEvent.setup()
    stubBackend(() => jsonResponse({ detail: 'boom' }, 500))
    renderPage('1')

    await user.click(await screen.findByRole('checkbox', { name: /bereitgelegt/ }))
    await user.click(screen.getByRole('button', { name: 'Kartenaufgabe starten' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Kartenaufgabe konnte nicht gestartet werden.')
  })

  it('continues an open run instead of starting a new one', async () => {
    stubBackend()
    renderPage('2')

    expect(await screen.findByRole('link', { name: 'Begonnene Kartenaufgabe fortsetzen' })).toHaveAttribute(
      'href',
      '/charts/attempts/9',
    )
    expect(screen.queryByRole('button', { name: 'Kartenaufgabe starten' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('offers the hints and the tide form before the start', async () => {
    stubBackend()
    renderPage('1')

    expect(await screen.findByText('Erlaubte Hilfsmittel: Übungskarte 49.')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Formblatt Gezeiten (leer)' })).toHaveAttribute(
      'src',
      '/charts/formblatt-gezeiten.png',
    )
  })

  it('says when there is no such exercise', async () => {
    stubBackend()
    renderPage('11')

    expect(await screen.findByText('Diese Kartenaufgabe gibt es nicht.')).toBeInTheDocument()
  })

  it('says so when the exercises cannot be loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ detail: 'down' }, 500)),
    )
    renderPage('1')

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Kartenaufgaben konnten nicht geladen werden.')
  })
})
