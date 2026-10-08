import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { primeChartCatalog, resetChartCatalog } from '../chartCatalog'
import { storageKey } from '../hooks/useTideForm'
import { useAuthStore } from '../store/authStore'
import { jsonResponse, makeChartAttempt, makeChartExport, makeChartOverview } from '../test/fixtures'
import { ChartExercisePage } from './ChartExercisePage'

// A data router (ADR-0059), as in the app: a guest's run asks before it is left (useBlocker). The
// overview comes first in the history, so Back from the sheet's page has somewhere to go.
function renderPage(number: string, path = `/charts/${number}`) {
  const router = createMemoryRouter(
    [
      { path: '/charts', element: <p>Overview page</p> },
      { path: '/charts/:number', element: <ChartExercisePage /> },
      { path: '/charts/attempts/:id', element: <p>Run page</p> },
    ],
    { initialEntries: ['/charts', path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const goBack = (router: ReturnType<typeof renderPage>) => act(() => router.navigate(-1))

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

  it('discards an open run after a confirmation, then offers a fresh start', async () => {
    const user = userEvent.setup()
    let discarded = false
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        discarded = true
        return new Response(null, { status: 204 })
      }
      const overview = makeChartOverview()
      if (discarded) overview.exercises[1] = { ...overview.exercises[1], open_attempt_id: null }
      return jsonResponse(overview)
    })
    vi.stubGlobal('fetch', fetchMock)
    renderPage('2')

    await user.click(await screen.findByRole('button', { name: 'Begonnene Kartenaufgabe verwerfen' }))
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))
    await user.click(screen.getByRole('button', { name: 'Begonnene Kartenaufgabe verwerfen' }))
    await user.click(screen.getByRole('button', { name: 'Endgültig löschen' }))

    expect(await screen.findByRole('button', { name: 'Kartenaufgabe starten' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Begonnene Kartenaufgabe fortsetzen' })).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/chart-exercises/attempts/9'),
      expect.objectContaining({ method: 'DELETE' }),
    )
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

  it('says when there is no such exercise, with the way to all of them', async () => {
    stubBackend()
    renderPage('11')

    expect(await screen.findByRole('heading', { level: 1, name: 'Seite nicht gefunden' })).toBeInTheDocument()
    expect(screen.getByText(/Diese Kartenaufgabe gibt es nicht\./)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Alle Kartenaufgaben' })).toHaveAttribute('href', '/charts')
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

describe('ChartExercisePage for a guest', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: false, isLoading: false, user: null })
    primeChartCatalog(makeChartExport())
  })
  afterEach(() => resetChartCatalog())

  it('runs a whole sheet in the page, sending nothing', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () => jsonResponse({ detail: 'no' }, 500))
    vi.stubGlobal('fetch', fetchMock)
    window.localStorage.setItem(storageKey('guest-1'), '{"stale":true}')
    renderPage('1')

    expect(screen.getByText(/Ohne Konto wird nichts gespeichert/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Kostenlos anmelden' })).toHaveAttribute('href', '/login')
    await user.click(screen.getByRole('button', { name: 'Kartenaufgabe starten' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Bestätige zuerst')
    await user.click(screen.getByRole('checkbox', { name: /bereitgelegt/ }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Kartenaufgabe starten' }))

    // A new run starts with an empty Formblatt.
    expect(window.localStorage.getItem(storageKey('guest-1'))).toBeNull()
    expect(screen.getAllByText('Aufgabe 1 / 2').length).toBeGreaterThan(0)
    expect(screen.queryByText('Ergebnis 1')).not.toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Deine Antwort' }), 'HW 12:30')
    await user.click(screen.getByRole('button', { name: 'Lösung anzeigen' }))
    expect(screen.getAllByText('Ergebnis 1').length).toBeGreaterThan(0)
    await user.click(screen.getByRole('radio', { name: '2' }))
    await user.click(screen.getByRole('button', { name: 'Weiter' }))

    await user.click(screen.getByRole('button', { name: 'Lösung anzeigen' }))
    await user.click(screen.getByRole('radio', { name: '1' }))
    await user.click(screen.getByRole('button', { name: 'Weiter' }))

    expect(screen.getByRole('heading', { name: 'Kartenaufgabe abgeschlossen' })).toBeInTheDocument()
    expect(screen.getByText(/Du hast dir/)).toHaveTextContent('Du hast dir 3 von 3 Punkten gegeben.')
    expect(screen.getByText(/Ohne Konto wird dieser Durchgang nicht gespeichert/)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    // Complete, the run is left without a question: its result already says nothing is kept.
    await user.click(screen.getByRole('link', { name: 'Zur Übersicht' }))
    expect(await screen.findByText('Overview page')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('starts the run as its own history entry, so Back leads to the page before the start', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn())
    const router = renderPage('1')

    await user.click(screen.getByRole('checkbox', { name: /bereitgelegt/ }))
    await user.click(screen.getByRole('button', { name: 'Kartenaufgabe starten' }))
    expect(router.state.location.search).toBe('?run=1')
    expect(screen.getAllByText('Aufgabe 1 / 2').length).toBeGreaterThan(0)

    // Nothing answered yet, so nothing to lose: no question.
    await goBack(router)
    expect(await screen.findByRole('button', { name: 'Kartenaufgabe starten' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/charts/1')
    expect(router.state.location.search).toBe('')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('asks before a run with answers is left, and stays or leaves as chosen', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn())
    const router = renderPage('1')

    await user.click(screen.getByRole('checkbox', { name: /bereitgelegt/ }))
    await user.click(screen.getByRole('button', { name: 'Kartenaufgabe starten' }))
    await user.type(screen.getByRole('textbox', { name: 'Deine Antwort' }), 'HW 12:30')
    await user.click(screen.getByRole('button', { name: 'Lösung anzeigen' }))

    await goBack(router)
    const dialog = await screen.findByRole('dialog', { name: 'Durchgang verwerfen?' })
    expect(dialog).toHaveTextContent('Antworten und Punkte')
    expect(screen.getByRole('button', { name: 'Weiterarbeiten' })).toHaveFocus()
    expect(router.state.location.search).toBe('?run=1')

    await user.click(screen.getByRole('button', { name: 'Weiterarbeiten' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getAllByText('Ergebnis 1').length).toBeGreaterThan(0)

    // A link out of the page (the header's), and Escape keeps the run too.
    await user.click(screen.getByRole('link', { name: 'Anmelden' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(router.state.location.search).toBe('?run=1')

    await goBack(router)
    await user.click(await screen.findByRole('button', { name: 'Verwerfen' }))
    expect(await screen.findByRole('button', { name: 'Kartenaufgabe starten' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('')
  })

  it('shows the page before the start for ?run without a run started here (a reload)', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const router = renderPage('1', '/charts/1?run=1')

    expect(screen.getByRole('button', { name: 'Kartenaufgabe starten' })).toBeInTheDocument()
    await vi.waitFor(() => expect(router.state.location.search).toBe(''))
    expect(router.state.location.pathname).toBe('/charts/1')
  })

  it('lists every task with its solution below, folded shut', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ detail: 'no' }, 500)),
    )
    renderPage('1')

    const list = screen.getByRole('region', { name: 'Alle Aufgaben dieser Kartenaufgabe' })
    expect(list.querySelectorAll('li > details:not([open])')).toHaveLength(2)
    expect(list).toHaveTextContent('Aufgabe 1')
    expect(list).toHaveTextContent('2 Punkte')
    expect(list).toHaveTextContent('Frage 2')
    expect(list).toHaveTextContent('Ergebnis 2')
  })

  it('says when there is no such sheet, with the way to all of them', () => {
    renderPage('7')
    expect(screen.getByRole('heading', { level: 1, name: 'Seite nicht gefunden' })).toBeInTheDocument()
    expect(screen.getByText(/Diese Kartenaufgabe gibt es nicht\./)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Alle Kartenaufgaben' })).toHaveAttribute('href', '/charts')
  })

  it('says so when the export cannot be loaded', async () => {
    resetChartCatalog()
    vi.doMock('../data/chart_exercises.gen.json', () => {
      throw new Error('offline')
    })
    renderPage('1')
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Kartenaufgaben konnten nicht geladen werden.')
    vi.doUnmock('../data/chart_exercises.gen.json')
  })
})
