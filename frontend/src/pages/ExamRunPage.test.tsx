import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import type { Exam } from '../api/types'
import { useAuthStore } from '../store/authStore'
import { examQuestion, focusWhenShown, jsonResponse, makeExam, makeUser } from '../test/fixtures'
import { ExamRunPage } from './ExamRunPage'

function renderRun() {
  return render(
    <MemoryRouter initialEntries={['/exam/7']}>
      <Routes>
        <Route path="/exam/:id" element={<ExamRunPage />} />
        <Route path="/exam" element={<p>Prüfungsübersicht</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const graded = (points: number) =>
  makeExam({
    status: 'completed',
    points,
    result: points >= 39 ? 'bestanden' : 'nicht_bestanden',
    submitted_at: new Date().toISOString(),
    group_scores: [{ subject_group: 'navigation', points, max_points: 4 }],
    questions: [
      examQuestion(1, { answer_text: 'Meine A1', official_answer: 'Amtlich 1', outcome: 'richtig', points: 2 }),
      examQuestion(2, { official_answer: 'Amtlich 2', outcome: 'falsch', points: 0 }),
    ],
  })

describe('ExamRunPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: true, isLoading: false })
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('shows an error when the exam cannot be loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ detail: 'nope' }, 404)),
    )
    renderRun()
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Prüfung konnte nicht geladen werden.')
  })

  it('autosaves answers, moves on with Enter, offers no tips and submits from the overview', async () => {
    const user = userEvent.setup()
    const submitted = makeExam({
      status: 'grading',
      questions: [
        examQuestion(1, { answer_text: 'Kompass', official_answer: 'Amtlich 1' }),
        examQuestion(2, { official_answer: 'Amtlich 2' }),
      ],
    })
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'PUT') return new Response(null, { status: 204 })
      if (init?.method === 'POST' && url.endsWith('/exams/7/submit')) return jsonResponse(submitted)
      return jsonResponse(makeExam())
    })
    vi.stubGlobal('fetch', fetchMock)
    const focusedOnShow = focusWhenShown('Frage 1?')
    renderRun()

    expect(await screen.findByText('Frage 1?')).toBeInTheDocument()
    // Already there when the question appears, not an effect later (this used to be flaky in CI).
    expect(focusedOnShow()).toBe(screen.getByLabelText('Deine Antwort'))
    expect(screen.queryByText(/tipp/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/amtliche antwort/i)).not.toBeInTheDocument()
    expect(screen.getByText('Frage 1 von 2')).toBeInTheDocument()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Frage|gelernt/i })).not.toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('90:00')

    // Shift+Enter is a line break, Enter moves on to the next question.
    await user.type(screen.getByLabelText('Deine Antwort'), 'Kom{Shift>}{Enter}{/Shift}pass')
    expect(screen.getByLabelText('Deine Antwort')).toHaveValue('Kom\npass')
    await user.keyboard('{Enter}')
    expect(await screen.findByText('Frage 2?')).toBeInTheDocument()
    expect(screen.getByText('Frage 2 von 2')).toBeInTheDocument()
    expect(screen.getByLabelText('Deine Antwort')).toHaveFocus()
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/exams/7/questions/1/answer'),
        expect.objectContaining({ method: 'PUT', body: JSON.stringify({ answer_text: 'Kom\npass' }) }),
      ),
    )

    // Enter on the last question leads to the overview, which shows everything.
    await user.keyboard('{Enter}')
    expect(await screen.findByText('Übersicht: 1 von 2 beantwortet')).toBeInTheDocument()
    expect(screen.getByText('Frage 1?')).toBeInTheDocument()
    expect(screen.getByText('Frage 2?')).toBeInTheDocument()
    expect(screen.getByText(/Kom\s*pass/)).toBeInTheDocument()
    expect(screen.getByText('Nicht beantwortet.')).toBeInTheDocument()

    // "Bearbeiten" goes back to that question, with the cursor in the field.
    await user.click(screen.getByRole('button', { name: 'Frage 1 bearbeiten' }))
    expect(screen.getByLabelText('Deine Antwort')).toHaveValue('Kom\npass')
    expect(screen.getByLabelText('Deine Antwort')).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Übersicht' }))
    await user.click(screen.getByRole('button', { name: 'Prüfung abgeben' }))
    expect(screen.getByText(/1 von 2 Fragen sind beantwortet/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Weiter bearbeiten' }))
    await user.click(screen.getByRole('button', { name: 'Prüfung abgeben' }))
    await user.click(screen.getByRole('button', { name: 'Ja, abgeben' }))

    expect(await screen.findByRole('heading', { name: 'Selbsteinschätzung' })).toBeInTheDocument()
  })

  it('saves one answer at a time, so a slow older save can never overwrite a newer text', async () => {
    const user = userEvent.setup()
    const puts: string[] = []
    let releaseFirst!: () => void
    const firstHeld = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        puts.push(JSON.parse(String(init.body)).answer_text)
        // The first save hangs until released; any later one answers at once.
        if (puts.length === 1) await firstHeld
        return new Response(null, { status: 204 })
      }
      return jsonResponse(makeExam())
    })
    vi.stubGlobal('fetch', fetchMock)
    renderRun()
    const field = await screen.findByLabelText('Deine Antwort')

    await user.type(field, 'Kom')
    await waitFor(() => expect(puts).toEqual(['Kom']))
    await user.type(field, 'pass')
    // Moving on asks for another save while the first is still in flight: it has to wait.
    await user.keyboard('{Enter}')
    await screen.findByText('Frage 2?')
    expect(puts).toEqual(['Kom'])

    releaseFirst()
    await waitFor(() => expect(puts).toEqual(['Kom', 'Kompass']))
  })

  it('shows an error when saving fails and reloads when the exam has ended', async () => {
    const user = userEvent.setup()
    let putStatus = 500
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') return jsonResponse({ detail: 'x' }, putStatus)
      return jsonResponse(putStatus === 409 ? makeExam({ status: 'grading' }) : makeExam())
    })
    vi.stubGlobal('fetch', fetchMock)
    renderRun()
    await screen.findByText('Frage 1?')

    await user.type(screen.getByLabelText('Deine Antwort'), 'a')
    expect(await screen.findByRole('alert')).toHaveTextContent('konnte nicht gespeichert werden')

    // The retry finds the exam over: the server says 409, the page re-reads it.
    putStatus = 409
    await user.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(await screen.findByRole('heading', { name: 'Selbsteinschätzung' })).toBeInTheDocument()
  })

  it('re-reads the exam when the countdown reaches zero', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const now = Date.now()
    let reads = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        reads += 1
        return jsonResponse(
          reads === 1
            ? makeExam({ deadline_at: new Date(now + 3000).toISOString(), server_now: new Date(now).toISOString() })
            : makeExam({ status: 'grading', timed_out: true }),
        )
      }),
    )
    renderRun()
    await screen.findByRole('timer')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000)
    })
    expect(await screen.findByRole('heading', { name: 'Selbsteinschätzung' })).toBeInTheDocument()
    expect(screen.getByText(/Die Zeit ist abgelaufen/)).toBeInTheDocument()
  })

  it('self-assesses by keyboard: focus starts before the options, Tab cycles, Enter saves', async () => {
    const user = userEvent.setup()
    const grading = makeExam({
      status: 'grading',
      questions: [
        examQuestion(1, { answer_text: 'Meine A1', official_answer: 'Amtlich 1' }),
        examQuestion(2, { official_answer: 'Amtlich 2' }),
      ],
    })
    const afterFirst: Exam = {
      ...grading,
      questions: [{ ...grading.questions[0], outcome: 'teilweise_richtig', points: 1 }, grading.questions[1]],
    }
    const responses = [jsonResponse(afterFirst), jsonResponse(graded(2))]
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === 'PUT' ? (responses.shift() ?? jsonResponse({}, 500)) : jsonResponse(grading),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderRun()

    expect(await screen.findByText('Frage 1?')).toBeInTheDocument()
    expect(screen.getByText('Meine A1')).toBeInTheDocument()
    expect(screen.getByText('Amtlich 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeDisabled()

    // Focus sits on the group, so the first Tab lands on "Richtig", then it cycles.
    // (waitFor: the focus effect runs after the first paint, so it can lag the text appearing.)
    await waitFor(() => expect(screen.getByRole('group', { name: 'Wie gut war deine Antwort?' })).toHaveFocus())
    await user.tab()
    expect(screen.getByLabelText('Richtig')).toHaveFocus()
    await user.tab()
    expect(screen.getByLabelText('Teilweise Richtig')).toHaveFocus()
    await user.tab()
    expect(screen.getByLabelText('Falsch')).toHaveFocus()
    await user.tab()
    expect(screen.getByLabelText('Richtig')).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByLabelText('Falsch')).toHaveFocus()
    await user.tab({ shift: true })
    await user.keyboard('{Enter}')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/exams/7/questions/1/grade'),
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ outcome: 'teilweise_richtig' }) }),
    )

    // The next answer starts with focus before the options again.
    expect(await screen.findByText('Frage 2?')).toBeInTheDocument()
    expect(screen.getByText('Nicht beantwortet.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('group', { name: 'Wie gut war deine Antwort?' })).toHaveFocus())
    await user.tab()
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('heading', { name: 'Prüfungsergebnis' })).toBeInTheDocument()
  })

  it('also saves a self-assessment chosen with the mouse', async () => {
    const user = userEvent.setup()
    const grading = makeExam({ status: 'grading', questions: [examQuestion(1, { official_answer: 'A' })] })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'PUT' ? jsonResponse(graded(2)) : jsonResponse(grading),
      ),
    )
    renderRun()
    await user.click(await screen.findByLabelText('Falsch'))
    await user.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(await screen.findByRole('heading', { name: 'Prüfungsergebnis' })).toBeInTheDocument()
  })

  function aiGradingUser() {
    useAuthStore.setState({
      isAuthenticated: true,
      isLoading: false,
      user: makeUser({ token_balance: 1 }),
    })
  }

  it('offers the Lotsen-Check during exam self-assessment, preselects its suggestion and scrolls "Weiter" into view', async () => {
    const user = userEvent.setup()
    aiGradingUser()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: window.innerHeight + 40,
    } as DOMRect)
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
    const grading = makeExam({
      status: 'grading',
      questions: [examQuestion(1, { answer_text: 'Meine A1', official_answer: 'Amtlich 1' })],
    })
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST' && url.includes('/ai-grade')) {
        return jsonResponse({ outcome: 'teilweise_richtig', feedback: 'Fast richtig.' })
      }
      return jsonResponse(grading)
    })
    vi.stubGlobal('fetch', fetchMock)
    renderRun()

    await user.click(await screen.findByRole('button', { name: /Antwort vom Lotsen bewerten lassen/ }))

    expect(await screen.findByText('Fast richtig.')).toBeInTheDocument()
    expect(screen.getByLabelText('Teilweise Richtig')).toBeChecked()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/questions/1/ai-grade'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ answer: 'Meine A1' }) }),
    )
    expect(scrollBy).toHaveBeenCalledWith({ top: 42, behavior: 'smooth' })
  })

  it('folds the Lotsen-Check into the exam self-assessment Tab loop', async () => {
    const user = userEvent.setup()
    aiGradingUser()
    const grading = makeExam({
      status: 'grading',
      questions: [examQuestion(1, { answer_text: 'Meine A1', official_answer: 'Amtlich 1' })],
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(grading)),
    )
    renderRun()

    const ask = await screen.findByRole('button', { name: /Antwort vom Lotsen bewerten lassen/ })
    await waitFor(() => expect(screen.getByRole('group', { name: 'Wie gut war deine Antwort?' })).toHaveFocus())
    await user.tab()
    await user.tab()
    await user.tab()
    expect(screen.getByLabelText('Falsch')).toHaveFocus()
    await user.tab()
    expect(ask).toHaveFocus()
    await user.tab()
    expect(screen.getByLabelText('Richtig')).toHaveFocus()
    await user.tab({ shift: true })
    expect(ask).toHaveFocus()
  })

  it('shows the images of a question while writing and of its official answer while grading', async () => {
    const question = { question_images: [{ src: 'q.png', width: 10, height: 10 }] }
    const answer = { src: 'a.png', width: 10, height: 10 }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(makeExam({ questions: [examQuestion(1, question)] }))),
    )
    renderRun()
    expect(await screen.findByRole('img', { name: 'Abbildung zur Frage' })).toHaveAttribute('src', '/catalog/q.png')
    cleanup()

    const grading = makeExam({
      status: 'grading',
      questions: [examQuestion(1, { ...question, official_answer: '', official_answer_images: [answer] })],
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(grading)),
    )
    renderRun()
    expect(await screen.findByRole('img', { name: 'Abbildung zur Frage' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Abbildung zur amtlichen Antwort' })).toHaveAttribute(
      'src',
      '/catalog/a.png',
    )
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('reports a failed grading save', async () => {
    const user = userEvent.setup()
    const grading = makeExam({ status: 'grading', questions: [examQuestion(1, { official_answer: 'A' })] })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'PUT' ? jsonResponse({ detail: 'x' }, 500) : jsonResponse(grading),
      ),
    )
    renderRun()
    await user.click(await screen.findByLabelText('Teilweise Richtig'))
    await user.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Bewertung konnte nicht gespeichert werden.')
  })

  it('shows the result of a finished exam with every question, and deletes it', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === 'DELETE' ? new Response(null, { status: 204 }) : jsonResponse(graded(45)),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderRun()

    expect(await screen.findByText('von 60 Punkten')).toBeInTheDocument()
    expect(screen.getByText('Bestanden')).toBeInTheDocument()
    expect(screen.getByText(/Kartenaufgabe/)).toBeInTheDocument()
    expect(screen.getByText('Meine A1')).toBeInTheDocument()
    expect(screen.getByText('Amtlich 1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Diese Prüfung löschen' }))
    await user.click(screen.getByRole('button', { name: 'Endgültig löschen' }))
    expect(await screen.findByText('Prüfungsübersicht')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/exams/7'),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('lets the learner back out of deleting and reports a failed delete', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'DELETE' ? jsonResponse({ detail: 'x' }, 500) : jsonResponse(graded(10)),
      ),
    )
    renderRun()
    await user.click(await screen.findByRole('button', { name: 'Diese Prüfung löschen' }))
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(screen.getByRole('button', { name: 'Diese Prüfung löschen' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Diese Prüfung löschen' }))
    await user.click(screen.getByRole('button', { name: 'Endgültig löschen' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('konnte nicht gelöscht werden')
  })
})
