import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChartAttempt } from '../api/types'
import { useAuthStore } from '../store/authStore'
import { chartTask, jsonResponse, makeChartAttempt, makeChartOverview } from '../test/fixtures'
import { ChartAttemptPage } from './ChartAttemptPage'

const SOLUTION = [{ src: 'bogen-03/aufgabe-01-loesung-1.png', width: 1040, height: 300 }]
const DERIVATION = [{ src: 'bogen-03/aufgabe-01-herleitung-1.png', width: 1040, height: 200 }]

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/charts/attempts/5']}>
      <Routes>
        <Route path="/charts/attempts/:id" element={<ChartAttemptPage />} />
        <Route path="/charts" element={<p>Übersicht</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

// GET returns `initial`; each PUT answers with the next run of `writes` (or `writeStatus` as an error).
function stubBackend(initial: ChartAttempt, writes: ChartAttempt[] = [], writeStatus = 200) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      return writeStatus === 200 ? jsonResponse(writes.shift()) : jsonResponse({ detail: 'nope' }, writeStatus)
    }
    return url.includes('/attempts/') ? jsonResponse(initial) : jsonResponse(makeChartOverview())
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const answered = makeChartAttempt({
  tasks: [chartTask(1, { answer_text: 'HWZ 08:53', solution_images: SOLUTION, derivation_images: DERIVATION })],
})

describe('ChartAttemptPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: true, isLoading: false })
    window.localStorage.clear()
  })

  it('shows the current task with its questions and points', async () => {
    stubBackend(makeChartAttempt())
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Aufgabe 1' })).toBeInTheDocument()
    expect(screen.getByText('Max. erreichbare Punkte: 2')).toBeInTheDocument()
    expect(screen.getByText('Lage 1.')).toBeInTheDocument()
    expect(screen.getByText('Frage 1a?')).toBeInTheDocument()
    expect(screen.getByText('Aufgabe 1 / 2')).toBeInTheDocument()
    expect(screen.getByText('0 / 4 Punkte bisher')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Kartenaufgabe 3' })).toBeInTheDocument()
  })

  it('reveals the official solution once the answer is saved', async () => {
    const user = userEvent.setup()
    const fetchMock = stubBackend(makeChartAttempt(), [answered])
    renderPage()

    await user.type(await screen.findByRole('textbox', { name: /Deine Antwort/ }), 'HWZ 08:53')
    await user.click(screen.getByRole('button', { name: 'Lösung anzeigen' }))

    expect(await screen.findByRole('img', { name: 'Amtliche Lösung zu Aufgabe 1' })).toHaveAttribute(
      'src',
      '/charts/bogen-03/aufgabe-01-loesung-1.png',
    )
    // The working that leads to the results is there, but folded away.
    const derivation = screen.getByText('Herleitung anzeigen')
    expect(derivation.closest('details')).not.toHaveAttribute('open')
    await user.click(derivation)
    expect(screen.getByRole('img', { name: 'Amtliche Herleitung zu Aufgabe 1' })).toHaveAttribute(
      'src',
      '/charts/bogen-03/aufgabe-01-herleitung-1.png',
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/chart-exercises/attempts/5/tasks/1/answer'),
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ answer_text: 'HWZ 08:53' }) }),
    )
  })

  it('reports a failed save and keeps the answer', async () => {
    const user = userEvent.setup()
    stubBackend(makeChartAttempt(), [], 500)
    renderPage()

    const field = await screen.findByRole('textbox', { name: /Deine Antwort/ })
    await user.type(field, 'HWZ')
    await user.click(screen.getByRole('button', { name: 'Lösung anzeigen' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Antwort konnte nicht gespeichert werden.')
    expect(field).toHaveValue('HWZ')
  })

  it('asks for the points before moving on, then shows the next task', async () => {
    const user = userEvent.setup()
    const next = makeChartAttempt({
      current_task: 2,
      points: 1,
      tasks: [chartTask(1, { answer_text: 'HWZ 08:53', solution_images: SOLUTION, points_awarded: 1 }), chartTask(2)],
    })
    const fetchMock = stubBackend(answered, [next])
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Weiter' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Wähle zuerst, wie viele Punkte du dir gibst.')

    const choices = screen.getByRole('group', { name: /Wie viele Punkte/ })
    expect(
      within(choices)
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('value')),
    ).toEqual(['0', '1', '2'])
    await user.click(within(choices).getByRole('radio', { name: '1' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Weiter' }))

    expect(await screen.findByRole('heading', { name: 'Aufgabe 2' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Deine Antwort/ })).toHaveValue('')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/tasks/1/points'),
      expect.objectContaining({ body: JSON.stringify({ points: 1 }) }),
    )
  })

  it('reports failed points', async () => {
    const user = userEvent.setup()
    stubBackend(answered, [], 409)
    renderPage()

    await user.click(await screen.findByRole('radio', { name: '2' }))
    await user.click(screen.getByRole('button', { name: 'Weiter' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Punkte konnten nicht gespeichert werden.')
  })

  it('keeps the tide form, the tasks so far and the hints at hand beside the task, as cards that fold', async () => {
    const user = userEvent.setup()
    stubBackend(
      makeChartAttempt({
        current_task: 2,
        points: 2,
        tasks: [
          chartTask(1, {
            answer_text: 'HWZ 08:53',
            solution_images: SOLUTION,
            derivation_images: DERIVATION,
            points_awarded: 2,
          }),
          chartTask(2),
        ],
      }),
    )
    renderPage()

    const panel = await screen.findByRole('complementary', { name: 'Hilfsmittel' })
    const form = within(panel).getByRole('button', { name: 'Formblatt Gezeiten' })
    expect(form).toHaveAttribute('aria-expanded', 'true')
    expect(within(panel).getByRole('textbox', { name: 'Bezugsort' })).toBeInTheDocument()
    await user.click(form)
    expect(form).toHaveAttribute('aria-expanded', 'false')
    expect(within(panel).queryByRole('textbox', { name: 'Bezugsort' })).not.toBeInTheDocument()

    await user.click(within(panel).getByRole('button', { name: 'Verlauf' }))
    expect(within(panel).getByText('2 / 2 Punkte')).toBeInTheDocument()
    expect(within(panel).getByText('HWZ 08:53')).toBeInTheDocument()
    expect(within(panel).getByRole('img', { name: 'Amtliche Lösung zu Aufgabe 1' })).toBeInTheDocument()

    await user.click(within(panel).getByRole('button', { name: 'Hinweise' }))
    expect(within(panel).getByText('Hinweise: Kurse auf volle Grade runden.')).toBeInTheDocument()
    expect(within(panel).getByText(/Quelle: WSV/)).toBeInTheDocument()
  })

  it('remembers which cards are open', async () => {
    const user = userEvent.setup()
    stubBackend(makeChartAttempt())
    const { unmount } = renderPage()
    const panel = await screen.findByRole('complementary', { name: 'Hilfsmittel' })
    await user.click(within(panel).getByRole('button', { name: 'Formblatt Gezeiten' }))
    await user.click(within(panel).getByRole('button', { name: 'Hinweise' }))
    unmount()

    renderPage()
    const again = await screen.findByRole('complementary', { name: 'Hilfsmittel' })
    expect(within(again).getByRole('button', { name: 'Formblatt Gezeiten' })).toHaveAttribute('aria-expanded', 'false')
    expect(within(again).getByRole('button', { name: 'Hinweise' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('lets the learner fill in the tide form, kept per run', async () => {
    const user = userEvent.setup()
    stubBackend(makeChartAttempt())
    const { unmount } = renderPage()
    const panel = await screen.findByRole('complementary', { name: 'Hilfsmittel' })

    await user.type(within(panel).getByRole('textbox', { name: 'Bezugsort' }), 'Helgoland')
    await user.selectOptions(
      within(panel).getByRole('combobox', { name: 'Hoch- oder Niedrigwasser, Spalte 1, oben' }),
      'H',
    )
    await user.type(within(panel).getByRole('textbox', { name: 'Bezugsort Zeit, Spalte 1 (1. HW), oben' }), '06:40')
    await user.type(within(panel).getByRole('textbox', { name: 'Anschlussort Höhe, Spalte 3 (2. _W), unten' }), '3,2')
    await user.type(within(panel).getByRole('textbox', { name: 'Bordzeit, Spalte 1 (1. HW), oben' }), '07:40')
    await user.click(within(panel).getAllByRole('checkbox', { name: 'Nippzeit' })[0])
    await user.click(within(panel).getAllByRole('checkbox', { name: 'Springzeit' })[0])
    unmount()

    renderPage()
    const again = await screen.findByRole('complementary', { name: 'Hilfsmittel' })
    expect(within(again).getByRole('textbox', { name: 'Bezugsort' })).toHaveValue('Helgoland')
    expect(within(again).getByRole('textbox', { name: 'Bezugsort Zeit, Spalte 1 (1. HW), oben' })).toHaveValue('06:40')
    expect(within(again).getByRole('textbox', { name: 'Anschlussort Höhe, Spalte 3 (2. _W), unten' })).toHaveValue(
      '3,2',
    )
    expect(within(again).getByRole('textbox', { name: 'Bordzeit, Spalte 1 (1. HW), oben' })).toHaveValue('07:40')
    expect(within(again).getAllByRole('checkbox', { name: 'Springzeit' })[0]).toBeChecked()
    expect(within(again).getAllByRole('checkbox', { name: 'Nippzeit' })[0]).not.toBeChecked()

    await user.click(within(again).getByRole('button', { name: 'Formblatt leeren' }))
    expect(within(again).getByRole('textbox', { name: 'Bezugsort' })).toHaveValue('')
  })

  it('opens the tools from the bar at the bottom on a phone, and closes them with Escape', async () => {
    const user = userEvent.setup()
    stubBackend(makeChartAttempt())
    renderPage()

    const bar = await screen.findByRole('navigation', { name: 'Hilfsmittel' })
    const opener = within(bar).getByRole('button', { name: 'Verlauf' })
    await user.click(opener)

    const sheet = screen.getByRole('dialog', { name: 'Verlauf' })
    expect(within(sheet).getByText('Noch keine Aufgabe beantwortet.')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Schließen' })).toHaveFocus()
    expect(opener).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()

    await user.click(within(bar).getByRole('button', { name: 'Formblatt Gezeiten' }))
    await user.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the result and every task once the run is complete', async () => {
    stubBackend(
      makeChartAttempt({
        current_task: null,
        completed_at: '2026-09-30T11:00:00Z',
        points: 3,
        tasks: [
          chartTask(1, { answer_text: 'A', solution_images: SOLUTION, points_awarded: 2 }),
          chartTask(2, { answer_text: '', solution_images: SOLUTION, points_awarded: 1 }),
        ],
      }),
    )
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Kartenaufgabe abgeschlossen' })).toBeInTheDocument()
    expect(screen.getByText(/von 4 Punkten gegeben/)).toHaveTextContent('Du hast dir 3 von 4 Punkten gegeben.')
    expect(screen.getByRole('link', { name: 'Zur Übersicht' })).toHaveAttribute('href', '/charts')
    await waitFor(() => expect(screen.getAllByText('(keine Antwort)').length).toBeGreaterThan(0))
  })

  it('discards the run after a confirmation and returns to the exercise', async () => {
    const user = userEvent.setup()
    const fetchMock = stubBackend(makeChartAttempt())
    render(
      <MemoryRouter initialEntries={['/charts/attempts/5']}>
        <Routes>
          <Route path="/charts/attempts/:id" element={<ChartAttemptPage />} />
          <Route path="/charts/:number" element={<p>Vorbereitung</p>} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: 'Diesen Durchgang verwerfen' }))
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))
    await user.click(screen.getByRole('button', { name: 'Diesen Durchgang verwerfen' }))
    fetchMock.mockImplementationOnce(async () => new Response(null, { status: 204 }))
    await user.click(screen.getByRole('button', { name: 'Endgültig löschen' }))

    expect(await screen.findByText('Vorbereitung')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/chart-exercises/attempts/5'),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('reports a failed discard', async () => {
    const user = userEvent.setup()
    const fetchMock = stubBackend(makeChartAttempt({ current_task: null, completed_at: '2026-09-30T11:00:00Z' }))
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Diesen Durchgang löschen' }))
    fetchMock.mockImplementationOnce(async () => jsonResponse({ detail: 'boom' }, 500))
    await user.click(screen.getByRole('button', { name: 'Endgültig löschen' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Der Durchgang konnte nicht gelöscht werden.')
  })

  it('says so when the run cannot be loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ detail: 'nope' }, 404)),
    )
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Kartenaufgabe konnte nicht geladen werden.')
  })
})
