import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '../shared/store/authStore'
import { jsonResponse, makeUser } from '../test/fixtures'
import { navigationSource } from './navigationCatalog'
import { navigationExportFixture } from './navigationFixture'
import { sbfRoutes } from './routes'

// The subtask being worked on (the history beside it repeats the done ones).
function currentSubtask(number: number) {
  return within(screen.getByText(`Teilaufgabe ${number} von 3`).closest('section')!)
}

function renderAt(path: string) {
  return render(<RouterProvider router={createMemoryRouter(sbfRoutes, { initialEntries: [path] })} />)
}

describe('Navigationsaufgaben for guests', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubEnv('VITE_SITE', 'sbf')
    vi.stubEnv('VITE_SBF', 'on')
    vi.stubGlobal('fetch', fetchMock)
    navigationSource.prime(navigationExportFixture())
  })

  afterEach(() => navigationSource.reset())

  it('lists the tasks with the hints, the chart named in one sentence', () => {
    renderAt('/navigation')

    expect(screen.getByRole('link', { name: 'Navigationsaufgabe 2' })).toHaveAttribute('href', '/navigation/2')
    expect(screen.getByText('Den Navigationsaufgaben liegt die Übungskarte D49 zugrunde.')).toBeInTheDocument()
    expect(screen.queryByText(/E007°43,12'/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Navigationsaufgaben' })).toHaveAttribute('href', '/navigation')
  })

  it('shows a task with its situation and starts the run', async () => {
    const user = userEvent.setup()
    renderAt('/navigation/1')

    expect(screen.getByText('Die Fahrt über Grund beträgt 8 kn.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Aufgabe starten' }))
    expect(screen.getByText('Teilaufgabe 1 von 3')).toBeInTheDocument()
    expect(screen.getByLabelText('Deine Antwort')).toHaveFocus()
  })

  it('runs by keyboard as SKS Lotse does: Enter shows the result, Tab cycles the points, Enter gives them', async () => {
    const user = userEvent.setup()
    renderAt('/navigation/1?run=1')

    await user.keyboard('rwK = 078°{Shift>}{Enter}{/Shift}geschätzt')
    expect(screen.getByLabelText('Deine Antwort')).toHaveValue('rwK = 078°\ngeschätzt')
    await user.keyboard('{Enter}')

    const result = currentSubtask(1).getByText('Amtliches Ergebnis').parentElement!
    expect(within(result).getByText('rwK = 079°')).toBeInTheDocument()
    expect(
      within(result).getByText(/Tippfehler im amtlichen Text korrigiert, dort steht „rwk = 079°“/),
    ).toBeInTheDocument()
    expect(within(result).getByText(/Toleranz: ±1°/)).toHaveTextContent('nicht amtlich, übliche Prüfungspraxis')

    await user.keyboard('{Tab}')
    expect(screen.getByRole('radio', { name: '0' })).toHaveFocus()
    await user.keyboard('{Tab}')
    expect(screen.getByRole('radio', { name: '1' })).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(screen.getByText('Teilaufgabe 2 von 3')).toBeInTheDocument()
    expect(screen.getByLabelText('Deine Antwort')).toHaveFocus()
  })

  it('shows the current subtask in the original, its result only once answered', async () => {
    const user = userEvent.setup()
    renderAt('/navigation/1?run=1')
    const panel = screen.getAllByRole('complementary', { name: 'Hilfsmittel' })[0]

    await user.click(within(panel).getByRole('button', { name: /Offizieller Originaltext/ }))
    const question = within(panel).getByRole('img', { name: 'Teilaufgabe 1 der Navigationsaufgabe 1 im Original' })
    expect(question).toHaveAttribute('src', '/navigation/originals/aufgabe-01-1-aufgabe.png')
    expect(within(panel).queryByRole('img', { name: /^Ergebnis/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ergebnis anzeigen' }))
    expect(within(panel).getByRole('img', { name: /^Ergebnis zu Teilaufgabe 1/ })).toHaveAttribute(
      'src',
      '/navigation/originals/aufgabe-01-1-ergebnis.png',
    )

    await user.click(screen.getByRole('radio', { name: '1' }))
    await user.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(
      within(panel).getByRole('img', { name: 'Teilaufgabe 2 der Navigationsaufgabe 1 im Original' }),
    ).toBeInTheDocument()
    expect(within(panel).queryByRole('img', { name: /^Ergebnis/ })).not.toBeInTheDocument()
  })

  it('goes on from the answer field to the button with Tab', async () => {
    const user = userEvent.setup()
    renderAt('/navigation/1?run=1')

    await user.keyboard('{Tab}')
    expect(screen.getByRole('button', { name: 'Ergebnis anzeigen' })).toHaveFocus()
  })

  it('asks for points before going on, shows footnotes, and ends with the evaluation', async () => {
    const user = userEvent.setup()
    renderAt('/navigation/1?run=1')

    await user.click(screen.getByRole('button', { name: 'Ergebnis anzeigen' }))
    await user.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(screen.getByText('Wähle zuerst, wie viele Punkte du dir gibst.')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: '1' }))
    await user.click(screen.getByRole('button', { name: 'Weiter' }))

    await user.click(screen.getByRole('button', { name: 'Ergebnis anzeigen' }))
    expect(currentSubtask(2).getByText('*) Der MgK lautet tatsächlich: 074°')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: '0' }))
    await user.click(screen.getByRole('button', { name: 'Weiter' }))

    await user.click(screen.getByRole('button', { name: 'Ergebnis anzeigen' }))
    expect(currentSubtask(3).queryByText(/Toleranz:/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: '1' }))
    await user.click(screen.getByRole('button', { name: 'Weiter' }))

    const evaluation = screen.getByRole('region', { name: 'Auswertung' })
    expect(evaluation).toHaveTextContent('2 von 3 Punkten: bestanden')
    const history = screen.getAllByRole('complementary', { name: 'Hilfsmittel' })[0]
    expect(within(history).getByText('Teilaufgabe 2')).toBeInTheDocument()
    expect(within(history).getByText('0 / 1 Punkt')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Noch einmal' }))
    expect(screen.getByText('Teilaufgabe 1 von 3')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('says when a task does not exist', () => {
    renderAt('/navigation/99')
    expect(screen.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeInTheDocument()
  })

  it('has no Navigationsaufgaben in a build without them', () => {
    vi.stubEnv('VITE_SBF', 'off')
    renderAt('/navigation')
    expect(screen.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeInTheDocument()
  })
})

describe('Navigationsaufgaben with an account (ADR-0071)', () => {
  type Row = {
    number: number
    answer_text: string
    point: number | null
    ai_checkable: boolean
    ai_suggestion: { correct: boolean; feedback: string; suspected_error: string } | null
  }
  let rows: Row[]
  let calls: string[]

  function attempt() {
    const assessed = rows.filter((row) => row.point !== null).length
    return {
      id: 4,
      task_number: 1,
      started_at: '2026-10-24T10:00:00Z',
      completed_at: assessed === 3 ? '2026-10-24T11:00:00Z' : null,
      subtask_count: 3,
      points: rows.reduce((sum, row) => sum + (row.point ?? 0), 0),
      current_subtask: assessed === 3 ? null : assessed + 1,
      subtasks: rows,
    }
  }

  // The backend of a run of three subtasks, the third a chart entry.
  async function backend(input: RequestInfo | URL, init?: RequestInit) {
    const path = new URL(String(input), 'http://x').pathname.replace('/api/v1', '')
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${path}`)
    const body = init?.body ? JSON.parse(String(init.body)) : {}
    if (path === '/auth/me') return jsonResponse(makeUser({ token_balance: 6 }))
    if (path === '/pricing') return jsonResponse({ ...PRICING })
    if (path === '/sbf-navigation') {
      return jsonResponse({
        pass_points: 2,
        tasks: [
          {
            number: 1,
            open_attempt_id: 4,
            open_answered: rows.length,
            completed_count: 0,
            last_points: null,
            last_completed_at: null,
          },
        ],
      })
    }
    if (path === '/sbf-navigation/attempts/4') return jsonResponse(attempt())
    const answer = path.match(/subtasks\/(\d)\/answer$/)
    if (answer) {
      rows = [
        ...rows,
        {
          number: Number(answer[1]),
          answer_text: body.answer_text,
          point: null,
          ai_checkable: answer[1] !== '3',
          ai_suggestion: null,
        },
      ]
      return jsonResponse(attempt())
    }
    const point = path.match(/subtasks\/(\d)\/point$/)
    if (point) {
      rows = rows.map((row) => (row.number === Number(point[1]) ? { ...row, point: body.point } : row))
      return jsonResponse(attempt())
    }
    const check = path.match(/subtasks\/(\d)\/ai-check$/)
    if (check) {
      rows = rows.map((row) =>
        row.number === Number(check[1])
          ? {
              ...row,
              ai_suggestion: {
                correct: true,
                feedback: 'Dein MgK 073° liegt innerhalb der üblichen Toleranz von ±1°.',
                suspected_error: '',
              },
            }
          : row,
      )
      return jsonResponse({ attempt: attempt(), tokens_remaining: 4 })
    }
    return jsonResponse({ detail: 'not found' }, 404)
  }

  const PRICING = {
    signup_bonus_tokens: 6,
    packages: [],
    checkout_enabled: true,
    catalog_check_tokens: 1,
    chart_check_tokens: 2,
    sbf_navigation_check_tokens: 2,
    check_max_answer_chars: 1000,
  }

  beforeEach(() => {
    vi.stubEnv('VITE_SITE', 'sbf')
    vi.stubEnv('VITE_SBF', 'on')
    vi.stubEnv('VITE_SBF_ACCOUNTS', 'on')
    rows = [{ number: 1, answer_text: 'rwK 078°', point: 1, ai_checkable: true, ai_suggestion: null }]
    calls = []
    vi.stubGlobal('fetch', vi.fn(backend))
    navigationSource.prime(navigationExportFixture())
  })

  afterEach(() => {
    navigationSource.reset()
    useAuthStore.setState(useAuthStore.getInitialState())
  })

  it('resumes the saved run, checks a subtask and preselects the suggested point', async () => {
    const user = userEvent.setup()
    renderAt('/navigation/1?run=1')

    // Resumed at subtask 2: the first is answered and graded on the server.
    expect(await screen.findByText('Teilaufgabe 2 von 3')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Deine Antwort'), 'MgK 073°')
    await user.click(screen.getByRole('button', { name: 'Ergebnis anzeigen' }))

    const check = await screen.findByRole('button', { name: /Antwort vom Lotsen bewerten lassen/ })
    expect(screen.getByText(/2 Tokens · du hast 6/)).toBeInTheDocument()
    await user.click(check)

    const suggestion = await screen.findByRole('status', { name: '' })
    expect(within(suggestion).getByText('Lotsen-Vorschlag: richtig – 1 Punkt')).toBeInTheDocument()
    expect(within(suggestion).getByText(/innerhalb der üblichen Toleranz/)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '1' })).toBeChecked()
    expect(calls).toContain('POST /sbf-navigation/attempts/4/subtasks/2/ai-check')

    await user.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(await screen.findByText('Teilaufgabe 3 von 3')).toBeInTheDocument()
    expect(calls).toContain('PUT /sbf-navigation/attempts/4/subtasks/2/point')
  })

  it('offers no check for a chart entry and ends with the saved evaluation', async () => {
    rows = [
      { number: 1, answer_text: 'rwK 079°', point: 1, ai_checkable: true, ai_suggestion: null },
      { number: 2, answer_text: 'MgK 074°', point: 1, ai_checkable: true, ai_suggestion: null },
    ]
    const user = userEvent.setup()
    renderAt('/navigation/1?run=1')

    expect(await screen.findByText('Teilaufgabe 3 von 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ergebnis anzeigen' }))
    await screen.findByRole('radio', { name: '1' })
    expect(screen.queryByRole('button', { name: /Antwort vom Lotsen bewerten lassen/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: '1' }))
    await user.click(screen.getByRole('button', { name: 'Weiter' }))

    expect(await screen.findByText(/3 von 3 Punkten/)).toBeInTheDocument()
    expect(screen.getByText(/Dein Lauf ist in deinem Konto gespeichert./)).toBeInTheDocument()
  })

  it('shows a guest the check as a teaser, the run kept in the page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith('/auth/me')
          ? jsonResponse({ detail: 'Not authenticated' }, 401)
          : jsonResponse({ ...PRICING }),
      ),
    )
    const user = userEvent.setup()
    renderAt('/navigation/1?run=1')

    await user.type(await screen.findByLabelText('Deine Antwort'), 'rwK 079°')
    await user.click(screen.getByRole('button', { name: 'Ergebnis anzeigen' }))

    const check = await screen.findByRole('button', { name: /Antwort vom Lotsen bewerten lassen/ })
    expect(check).toBeDisabled()
    expect(screen.getByText(/Mit Anmeldung, Start-Tokens geschenkt/)).toBeInTheDocument()
  })
})
