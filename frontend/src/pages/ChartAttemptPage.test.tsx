import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChartAttempt } from '../api/types'
import { useAuthStore } from '../store/authStore'
import { chartTask, jsonResponse, makeChartAttempt, makeChartOverview, makeUser } from '../test/fixtures'
import { ChartAttemptPage } from './ChartAttemptPage'

const SOLUTION = [
  { results: [{ text: 'HWZ = 08:53 MESZ/BZ', tolerance: 'Keine Toleranz' }, { text: 'HWH = 3,2 m' }] },
  {
    results: [{ text: 'Stromdreieck' }],
    image: { src: 'bogen-03/aufgabe-01-stromdreieck.png', width: 632, height: 632 },
  },
]
const DERIVATION = [
  { text: 'Alter der Gezeit: **Nippzeit (NpZ)**' },
  {
    table: [
      { cells: ['MgP', '=', '054°', '348°'], sum: false },
      { cells: ['Abl', '=', '+10°', '+11°'], sum: true, sum_until: 3 },
      { cells: ['rwP', '=', '065°', '360°'], sum: true },
    ],
  },
]

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
  tasks: [chartTask(1, { answer_text: 'HWZ 08:53', solution: SOLUTION, derivation: DERIVATION })],
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

    // One bullet per scoring part; a result with its tolerance, a drawing as the PDF's image.
    const solution = await screen.findByRole('list')
    expect(within(solution).getAllByRole('listitem')).toHaveLength(2)
    expect(within(solution).getByText('HWZ = 08:53 MESZ/BZ')).toBeInTheDocument()
    expect(within(solution).getByText('[Keine Toleranz]')).toBeInTheDocument()
    expect(within(solution).getByText('HWH = 3,2 m')).toBeInTheDocument()
    expect(within(solution).getByRole('img', { name: 'Amtliche Zeichnung' })).toHaveAttribute(
      'src',
      '/charts/bogen-03/aufgabe-01-stromdreieck.png',
    )
    // The working that leads to the results is there, but folded away.
    const derivation = screen.getByText('Herleitung anzeigen')
    expect(derivation.closest('details')).not.toHaveAttribute('open')
    await user.click(derivation)
    // **…** is what the PDF prints bold.
    expect(screen.getByText('Nippzeit (NpZ)').tagName).toBe('STRONG')
    // A sum is ruled off above — across the row, or only its first cells.
    expect(screen.getByText('rwP').closest('td')).toHaveClass('border-t')
    expect(screen.getByText('360°').closest('td')).toHaveClass('border-t')
    expect(screen.getByText('+10°').closest('td')).toHaveClass('border-t')
    expect(screen.getByText('+11°').closest('td')).not.toHaveClass('border-t')
    expect(screen.getByText('MgP').closest('td')).not.toHaveClass('border-t')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/chart-exercises/attempts/5/tasks/1/answer'),
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ answer_text: 'HWZ 08:53' }) }),
    )
  })

  it('explains what goes into the answer behind an info marker', async () => {
    const user = userEvent.setup()
    stubBackend(makeChartAttempt())
    renderPage()

    const field = await screen.findByRole('textbox', { name: 'Deine Antwort' })
    expect(field).toHaveAccessibleDescription(/Hier notierst du die Ergebnisse\./)
    const marker = screen.getByRole('button', { name: 'Hinweis' })
    const tip = screen.getByRole('tooltip', { hidden: true })
    expect(tip).toHaveClass('hidden')

    await user.click(marker)
    expect(marker).toHaveAttribute('aria-expanded', 'true')
    expect(tip).not.toHaveClass('hidden')
    await user.keyboard('{Escape}')
    expect(tip).toHaveClass('hidden')
  })

  it('breaks the line on Shift+Enter and saves the answer on Enter', async () => {
    const user = userEvent.setup()
    const fetchMock = stubBackend(makeChartAttempt(), [answered])
    renderPage()

    const field = await screen.findByRole('textbox', { name: /Deine Antwort/ })
    await waitFor(() => expect(field).toHaveFocus())
    await user.keyboard('HWZ 08:53{Shift>}{Enter}{/Shift}HWH 3,2 m')
    expect(field).toHaveValue('HWZ 08:53\nHWH 3,2 m')
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/answer'), expect.anything())

    await user.keyboard('{Enter}')
    expect(await screen.findByText('Herleitung anzeigen')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/chart-exercises/attempts/5/tasks/1/answer'),
      expect.objectContaining({ body: JSON.stringify({ answer_text: 'HWZ 08:53\nHWH 3,2 m' }) }),
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

  it('cycles through the points with Tab and gives the focused ones on Enter', async () => {
    const user = userEvent.setup()
    const fetchMock = stubBackend(answered, [makeChartAttempt({ current_task: 2, tasks: [chartTask(2)] })])
    renderPage()

    await screen.findByRole('group', { name: /Wie viele Punkte/ })
    for (const name of ['0', '1', '2', '0']) {
      await user.tab()
      expect(screen.getByRole('radio', { name })).toHaveFocus()
    }
    await user.tab({ shift: true })
    expect(screen.getByRole('radio', { name: '2' })).toHaveFocus()
    expect(screen.getByRole('radio', { name: '2' })).not.toBeChecked()

    await user.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { name: 'Aufgabe 2' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/tasks/1/points'),
      expect.objectContaining({ body: JSON.stringify({ points: 2 }) }),
    )
  })

  it('asks for the points before moving on, then shows the next task', async () => {
    const user = userEvent.setup()
    const next = makeChartAttempt({
      current_task: 2,
      points: 1,
      tasks: [chartTask(1, { answer_text: 'HWZ 08:53', solution: SOLUTION, points_awarded: 1 }), chartTask(2)],
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

  it('keeps the tide form and the tasks so far at hand beside the task, as cards that fold', async () => {
    const user = userEvent.setup()
    stubBackend(
      makeChartAttempt({
        current_task: 2,
        points: 2,
        tasks: [
          chartTask(1, {
            answer_text: 'HWZ 08:53',
            solution: SOLUTION,
            derivation: DERIVATION,
            points_awarded: 2,
          }),
          chartTask(2, { answer_text: 'FD 6 h' }),
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
    // In the sheet's order, the task just answered last.
    expect(
      within(panel)
        .getAllByText(/^Aufgabe \d$/)
        .map((item) => item.textContent),
    ).toEqual(['Aufgabe 1', 'Aufgabe 2'])
    expect(within(panel).getByText('noch nicht bewertet')).toBeInTheDocument()
    expect(within(panel).getByText('2 / 2 Punkte')).toBeInTheDocument()
    expect(within(panel).getByText('HWZ 08:53')).toBeInTheDocument()
    expect(within(panel).getByText('HWZ = 08:53 MESZ/BZ')).toBeInTheDocument()
    // The sheet's rules are read before the start, not during the run.
    expect(within(panel).queryByRole('button', { name: 'Hinweise' })).not.toBeInTheDocument()
  })

  it('remembers which cards are open', async () => {
    const user = userEvent.setup()
    stubBackend(makeChartAttempt())
    const { unmount } = renderPage()
    const panel = await screen.findByRole('complementary', { name: 'Hilfsmittel' })
    await user.click(within(panel).getByRole('button', { name: 'Formblatt Gezeiten' }))
    await user.click(within(panel).getByRole('button', { name: 'Verlauf' }))
    unmount()

    renderPage()
    const again = await screen.findByRole('complementary', { name: 'Hilfsmittel' })
    expect(within(again).getByRole('button', { name: 'Formblatt Gezeiten' })).toHaveAttribute('aria-expanded', 'false')
    expect(within(again).getByRole('button', { name: 'Verlauf' })).toHaveAttribute('aria-expanded', 'true')
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

  it('keeps Tab inside the phone sheet and closes it on a tap on the page above', async () => {
    const user = userEvent.setup()
    stubBackend(makeChartAttempt())
    renderPage()

    const bar = await screen.findByRole('navigation', { name: 'Hilfsmittel' })
    await user.click(within(bar).getByRole('button', { name: 'Verlauf' }))
    const close = within(screen.getByRole('dialog', { name: 'Verlauf' })).getByRole('button', { name: 'Schließen' })
    await user.tab()
    expect(close).toHaveFocus()

    await user.click(screen.getByTestId('modal-backdrop'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the result and every task once the run is complete', async () => {
    stubBackend(
      makeChartAttempt({
        current_task: null,
        completed_at: '2026-09-30T11:00:00Z',
        points: 3,
        tasks: [
          chartTask(1, { answer_text: 'A', solution: SOLUTION, points_awarded: 2 }),
          chartTask(2, { answer_text: '', solution: [{ results: [{ text: 'KaK = 059°' }] }], points_awarded: 1 }),
        ],
      }),
    )
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Kartenaufgabe abgeschlossen' })).toBeInTheDocument()
    expect(screen.getByText(/von 4 Punkten gegeben/)).toHaveTextContent('Du hast dir 3 von 4 Punkten gegeben.')
    expect(screen.getByRole('link', { name: 'Zur Übersicht' })).toHaveAttribute('href', '/charts')
    await waitFor(() => expect(screen.getAllByText('(keine Antwort)').length).toBeGreaterThan(0))
    // A solution of a single part needs no bullet.
    const single = screen.getAllByText('KaK = 059°')[0].closest('section')
    expect(single && within(single).queryByRole('list')).toBeNull()
  })

  it('offers to delete a finished run, not one still running, and returns to the exercise', async () => {
    const user = userEvent.setup()
    const finished = makeChartAttempt({ current_task: null, completed_at: '2026-09-30T11:00:00Z' })
    const fetchMock = stubBackend(finished)
    render(
      <MemoryRouter initialEntries={['/charts/attempts/5']}>
        <Routes>
          <Route path="/charts/attempts/:id" element={<ChartAttemptPage />} />
          <Route path="/charts/:number" element={<p>Vorbereitung</p>} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: 'Diesen Durchgang löschen' }))
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))
    await user.click(screen.getByRole('button', { name: 'Diesen Durchgang löschen' }))
    fetchMock.mockImplementationOnce(async () => new Response(null, { status: 204 }))
    window.localStorage.setItem('sks-lotse:tide-form:5', '{}')
    window.localStorage.setItem('sks-lotse:tide-form:6', '{}')
    await user.click(screen.getByRole('button', { name: 'Endgültig löschen' }))

    expect(await screen.findByText('Vorbereitung')).toBeInTheDocument()
    // Only the discarded run's Formblatt goes with it.
    expect(window.localStorage.getItem('sks-lotse:tide-form:5')).toBeNull()
    expect(window.localStorage.getItem('sks-lotse:tide-form:6')).toBe('{}')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/chart-exercises/attempts/5'),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('has no way to discard the run beside a task', async () => {
    stubBackend(makeChartAttempt())
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Aufgabe 1' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /verwerfen|löschen/ })).not.toBeInTheDocument()
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

describe('ChartAttemptPage – Lotsen-Check', () => {
  const suggestion = {
    points: 1,
    feedback: 'Die HWZ stimmt, die HWH fehlt.',
    suspected_error: 'Vermutlich hast du nur die Zeit abgelesen.',
  }

  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: true, isLoading: false, user: makeUser({ token_balance: 6 }) })
    window.localStorage.clear()
  })

  function stubCheck(result: ChartAttempt | null, status = 200) {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return status === 200
          ? jsonResponse({ attempt: result, tokens_remaining: 4 })
          : jsonResponse({ detail: 'nope' }, status)
      }
      return url.includes('/attempts/') ? jsonResponse(answered) : jsonResponse(makeChartOverview())
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('suggests points with the probable mistake, picks them, and leaves giving them to the learner', async () => {
    const user = userEvent.setup()
    const checked = makeChartAttempt({
      tasks: [chartTask(1, { ...answered.tasks[0], ai_suggestion: suggestion })],
    })
    const fetchMock = stubCheck(checked)
    renderPage()

    const button = await screen.findByRole('button', { name: /Antwort vom Lotsen bewerten lassen/ })
    expect(button).toHaveTextContent('2 Tokens · du hast 6')
    await user.click(button)

    const box = await screen.findByRole('status')
    expect(box).toHaveTextContent('Lotsen-Vorschlag: 1 von 2 Punkten')
    expect(box).toHaveTextContent('Die HWZ stimmt, die HWH fehlt.')
    expect(box).toHaveTextContent('Vermuteter Fehler: Vermutlich hast du nur die Zeit abgelesen.')
    expect(screen.getByRole('radio', { name: '1' })).toBeChecked()
    expect(useAuthStore.getState().user?.token_balance).toBe(4)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/chart-exercises/attempts/5/tasks/1/ai-check'),
      expect.objectContaining({ method: 'POST' }),
    )
    // Only the points are the learner's step: nothing was given yet.
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/points'), expect.anything())
  })

  it('sits below the points, in their Tab loop, and puts focus on the points it suggests', async () => {
    const user = userEvent.setup()
    const checked = makeChartAttempt({
      tasks: [chartTask(1, { ...answered.tasks[0], ai_suggestion: suggestion })],
    })
    stubCheck(checked)
    renderPage()

    const group = await screen.findByRole('group', { name: /Wie viele Punkte/ })
    const button = screen.getByRole('button', { name: /Antwort vom Lotsen bewerten lassen/ })
    expect(group.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    for (const name of ['0', '1', '2']) {
      await user.tab()
      expect(screen.getByRole('radio', { name })).toHaveFocus()
    }
    await user.tab()
    expect(button).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('radio', { name: '0' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(button).toHaveFocus()

    await user.keyboard('{Enter}')
    await screen.findByRole('status')
    expect(screen.getByRole('radio', { name: '1' })).toHaveFocus()
    expect(screen.getByRole('radio', { name: '1' })).toBeChecked()
  })

  it('shows a stored suggestion after a reload instead of offering a second check', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/attempts/')
          ? jsonResponse(makeChartAttempt({ tasks: [chartTask(1, { answer_text: 'HWZ', ai_suggestion: suggestion })] }))
          : jsonResponse(makeChartOverview()),
      ),
    )
    renderPage()

    expect(await screen.findByRole('status')).toHaveTextContent('Lotsen-Vorschlag: 1 von 2 Punkten')
    expect(screen.queryByRole('button', { name: /Antwort vom Lotsen bewerten lassen/ })).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '1' })).toBeChecked()
  })

  it('is not offered where a drawing scores', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/attempts/')
          ? jsonResponse(makeChartAttempt({ tasks: [chartTask(1, { answer_text: 'KdW 092°', ai_checkable: false })] }))
          : jsonResponse(makeChartOverview()),
      ),
    )
    renderPage()

    expect(
      await screen.findByText('Wie viele Punkte hättest du in der Prüfung bekommen?', { exact: false }),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: /Antwort vom Lotsen bewerten lassen/ })).not.toBeInTheDocument()
  })

  it('is dimmed without an answer or with too few tokens', async () => {
    useAuthStore.setState({ user: makeUser({ token_balance: 1, can_buy_tokens: true }) })
    stubCheck(null)
    renderPage()

    const button = await screen.findByRole('button', { name: /Antwort vom Lotsen bewerten lassen/ })
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('Keine Tokens mehr')
    expect(screen.getByRole('link', { name: 'Tokens kaufen' })).toHaveAttribute('href', '/pricing')
  })

  it('has nothing to check without an answer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/attempts/')
          ? jsonResponse(makeChartAttempt({ tasks: [chartTask(1, { answer_text: '  ' })] }))
          : jsonResponse(makeChartOverview()),
      ),
    )
    renderPage()

    const button = await screen.findByRole('button', { name: /Antwort vom Lotsen bewerten lassen/ })
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('Ohne Antwort gibt es nichts zu prüfen')
  })

  it('reports a failed check and leaves the self-assessment as it was', async () => {
    const user = userEvent.setup()
    stubCheck(null, 503)
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Antwort vom Lotsen bewerten lassen/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Der Lotse ist gerade nicht erreichbar.')
    expect(screen.getByRole('radio', { name: '1' })).not.toBeChecked()
  })

  it('shows the suggestion with the task in the tasks so far', async () => {
    const user = userEvent.setup()
    const done = makeChartAttempt({
      current_task: 2,
      tasks: [chartTask(1, { answer_text: 'HWZ', points_awarded: 1, ai_suggestion: suggestion }), chartTask(2)],
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/attempts/') ? jsonResponse(done) : jsonResponse(makeChartOverview()),
      ),
    )
    renderPage()

    const panel = await screen.findByRole('complementary', { name: 'Hilfsmittel' })
    await user.click(within(panel).getByRole('button', { name: 'Verlauf' }))
    expect(within(panel).getByText('Vermuteter Fehler:')).toBeInTheDocument()
    expect(within(panel).getByText('Lotsen-Vorschlag: 1 von 2 Punkten')).toBeInTheDocument()
    expect(within(panel).queryByText('Nur ein Vorschlag', { exact: false })).not.toBeInTheDocument()
  })
})
