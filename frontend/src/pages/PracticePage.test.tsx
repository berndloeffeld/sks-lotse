import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import type { Question, QuestionProgress } from '../api/types'
import { useAuthStore } from '../store/authStore'
import { PracticePage } from './PracticePage'
import { jsonResponse, makeUser } from '../test/fixtures'

function question(id: number, number: number): Question {
  return {
    id,
    subject: 'navigation',
    number,
    question_text: `Frage ${number}?`,
    answer_text: `Antwort ${number}.`,
    question_images: [],
    answer_images: [],
    topic: 'ankern',
  }
}

const topics = [{ subject: 'navigation', slug: 'ankern', name: 'Ankern', display_order: 1 }]

interface Backend {
  questions?: ReturnType<typeof question>[]
  progress?: QuestionProgress[]
  // Response to each POST /progress/questions/{id}, in order.
  grades?: Response[]
  failLoad?: boolean
  // Response to POST /questions/{id}/ai-grade.
  aiGrade?: Response
}

function mockBackend({ questions = [question(1, 7)], progress = [], grades = [], failLoad = false, aiGrade }: Backend) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (failLoad) return jsonResponse({ detail: 'boom' }, 500)
    if (init?.method === 'POST' && url.includes('/ai-grade')) return aiGrade ?? jsonResponse({ detail: 'x' }, 503)
    if (init?.method === 'POST' && url.includes('/progress/questions/')) {
      return grades.shift() ?? jsonResponse({ detail: 'unexpected' }, 500)
    }
    if (url.includes('/questions?')) return jsonResponse(questions)
    if (url.endsWith('/progress/questions')) return jsonResponse(progress)
    if (url.includes('/topics?')) return jsonResponse(topics)
    return jsonResponse({ detail: 'not found' }, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPracticePage() {
  return render(
    <MemoryRouter initialEntries={['/learn/navigation/ankern']}>
      <Routes>
        <Route path="/learn/:subject/:topic" element={<PracticePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function revealAndGrade(outcome: string) {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Lösung anzeigen' }))
  await user.click(screen.getByRole('radio', { name: outcome }))
  await user.click(screen.getByRole('button', { name: 'Weiter' }))
  return user
}

function mockReducedMotion(reduced: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: reduced && query.includes('reduce'), media: query })),
  )
}

describe('PracticePage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: true, isLoading: false })
    // jsdom has no matchMedia; by default tests run as reduced motion, i.e.
    // without the pause that lets the boat sail before the next question.
    mockReducedMotion(true)
  })

  it('loads the topic and asks the scoped questions', async () => {
    const fetchMock = mockBackend({})

    renderPracticePage()

    expect(await screen.findByRole('heading', { name: 'Frage 7?' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Ankern' })).toBeInTheDocument()
    expect(screen.getByText('Frage 1 von 1 · Nr. 7')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/questions?subject=navigation&topic=ankern'))).toBe(
      true,
    )
    // The official answer stays hidden until asked for.
    expect(screen.queryByText('Antwort 7.')).not.toBeInTheDocument()
  })

  it('offers the AI check only as a teaser without tokens', async () => {
    const user = userEvent.setup()
    mockBackend({})
    renderPracticePage()

    await user.click(await screen.findByRole('button', { name: 'Lösung anzeigen' }))

    expect(screen.getByRole('button', { name: /Antwort vom Lotsen bewerten lassen/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Antwort vom Lotsen bewerten lassen/ })).toHaveTextContent(
      'bald verfügbar',
    )
  })

  it('preselects the AI suggestion, which the learner still saves', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({
      user: makeUser({ email: 'a@example.com', token_balance: 1 }),
    })
    mockBackend({
      aiGrade: jsonResponse({ outcome: 'falsch', feedback: 'Das stimmt nicht.' }),
    })
    renderPracticePage()

    await user.type(await screen.findByLabelText(/Deine Antwort/), 'irgendwas')
    await user.click(screen.getByRole('button', { name: 'Lösung anzeigen' }))
    await user.click(screen.getByRole('button', { name: /Antwort vom Lotsen bewerten lassen/ }))

    expect(await screen.findByText('Das stimmt nicht.')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Falsch' })).toBeChecked()
  })

  it('Tab loops through the grade radios and then the Lotse row', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({
      user: makeUser({ email: 'a@example.com', token_balance: 1 }),
    })
    mockBackend({ aiGrade: jsonResponse({ outcome: 'teilweise_richtig', feedback: 'Fast.' }) })
    renderPracticePage()

    await user.type(await screen.findByLabelText(/Deine Antwort/), 'irgendwas')
    await user.click(screen.getByRole('button', { name: 'Lösung anzeigen' }))
    const ask = screen.getByRole('button', { name: /Antwort vom Lotsen bewerten lassen/ })
    for (const name of ['Richtig', 'Teilweise Richtig', 'Falsch']) {
      await user.tab()
      expect(screen.getByRole('radio', { name })).toHaveFocus()
    }
    await user.tab()
    expect(ask).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('radio', { name: 'Richtig' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(ask).toHaveFocus()

    // After the check, focus lands on the suggested radio.
    await user.click(screen.getByRole('button', { name: /Antwort vom Lotsen bewerten lassen/ }))
    await screen.findByText('Fast.')
    expect(screen.getByRole('radio', { name: 'Teilweise Richtig' })).toHaveFocus()
  })

  it('Enter on the Lotsen-Check suggestion saves it and moves to the next question', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({
      user: makeUser({ email: 'a@example.com', token_balance: 1 }),
    })
    const fetchMock = mockBackend({
      questions: [question(1, 7), question(2, 8)],
      aiGrade: jsonResponse({ outcome: 'richtig', feedback: 'Passt.' }),
      grades: [jsonResponse({ question_id: 1, progress: 0.4, learned: false })],
    })
    vi.spyOn(Math, 'random').mockReturnValue(0)
    renderPracticePage()

    await user.type(await screen.findByLabelText(/Deine Antwort/), 'irgendwas')
    await user.click(screen.getByRole('button', { name: 'Lösung anzeigen' }))
    await user.click(screen.getByRole('button', { name: /Antwort vom Lotsen bewerten lassen/ }))
    await screen.findByText('Passt.')
    expect(screen.getByRole('radio', { name: 'Richtig' })).toHaveFocus()

    await user.keyboard('{Enter}')

    expect(await screen.findByText('Frage 2 von 2 · Nr. 7')).toBeInTheDocument()
    const post = fetchMock.mock.calls.find(([u]) => String(u).includes('/progress/questions/'))
    expect(JSON.parse(String((post?.[1] as RequestInit).body))).toEqual({ outcome: 'richtig' })
  })

  it('goes straight into the radios when there is no AI check to use', async () => {
    const user = userEvent.setup()
    mockBackend({})
    renderPracticePage()

    await user.click(await screen.findByRole('button', { name: 'Lösung anzeigen' }))
    await user.tab()
    expect(screen.getByRole('radio', { name: 'Richtig' })).toHaveFocus()
  })

  it('reveals the official answer next to the learner’s own note', async () => {
    const user = userEvent.setup()
    mockBackend({})
    renderPracticePage()

    await user.type(await screen.findByRole('textbox'), 'Mein Versuch')
    await user.click(screen.getByRole('button', { name: 'Lösung anzeigen' }))

    expect(screen.getByText('Antwort 7.')).toBeInTheDocument()
    expect(screen.getByText('Mein Versuch')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeDisabled()
  })

  it('scrolls down until the "Weiter" button clears the fold, plus 2px, when the answer is revealed', async () => {
    const user = userEvent.setup()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: window.innerHeight + 40,
    } as DOMRect)
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
    mockBackend({})
    renderPracticePage()

    await user.click(await screen.findByRole('button', { name: 'Lösung anzeigen' }))

    expect(scrollBy).toHaveBeenCalledWith({ top: 42, behavior: 'smooth' })
  })

  it('shows the question images at once and the answer images with the official answer', async () => {
    const user = userEvent.setup()
    mockBackend({
      questions: [
        {
          ...question(1, 7),
          question_images: [{ src: 'navigation-7-1.png', width: 64, height: 49 }],
          answer_images: [{ src: 'navigation-7-2.png', width: 64, height: 49 }],
        },
      ],
    })
    renderPracticePage()

    expect(await screen.findByRole('img', { name: 'Abbildung zur Frage' })).toHaveAttribute(
      'src',
      '/catalog/navigation-7-1.png',
    )
    expect(screen.queryByRole('img', { name: 'Abbildung zur amtlichen Antwort' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Lösung anzeigen' }))

    expect(screen.getByRole('img', { name: 'Abbildung zur amtlichen Antwort' })).toHaveAttribute(
      'src',
      '/catalog/navigation-7-2.png',
    )
  })

  it('shows an answer that is only a sketch as its image, without an explanation', async () => {
    const user = userEvent.setup()
    mockBackend({
      questions: [
        { ...question(1, 7), answer_text: '', answer_images: [{ src: 'navigation-7-2.png', width: 64, height: 49 }] },
      ],
    })
    renderPracticePage()

    await user.click(await screen.findByRole('button', { name: 'Lösung anzeigen' }))

    expect(screen.getByRole('img', { name: 'Abbildung zur amtlichen Antwort' })).toBeInTheDocument()
    expect(screen.queryByText(/besteht nur aus einer Skizze/)).not.toBeInTheDocument()
  })

  it('explains an official answer that is only a sketch', async () => {
    const user = userEvent.setup()
    mockBackend({ questions: [{ ...question(1, 7), answer_text: '' }] })
    renderPracticePage()

    await user.click(await screen.findByRole('button', { name: 'Lösung anzeigen' }))

    expect(screen.getByText(/besteht nur aus einer Skizze/)).toBeInTheDocument()
  })

  it('saves a self-assessment and sails the boat forward', async () => {
    const fetchMock = mockBackend({
      progress: [{ question_id: 1, progress: 0.4, learned: false }],
      grades: [jsonResponse({ question_id: 1, progress: 0.9, learned: false })],
    })
    renderPracticePage()
    expect(await screen.findByRole('img', { name: 'Auf Kurs zu gelernt' })).toBeInTheDocument()

    await revealAndGrade('Richtig')

    // Saving moves straight on (here: to the round summary); no extra click.
    expect(await screen.findByRole('heading', { name: 'Runde beendet' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Richtig – ein Stück näher am Ziel.')
    // Nothing on the page gives away how many correct answers "gelernt" takes.
    expect(screen.queryByText(/von 3/)).not.toBeInTheDocument()
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(String(post[0])).toMatch(/\/progress\/questions\/1$/)
    expect(JSON.parse(String(post[1]!.body))).toEqual({ outcome: 'richtig' })
  })

  it('lets the boat sail to the new status before showing the next question', async () => {
    mockReducedMotion(false)
    mockBackend({
      questions: [question(1, 7), question(2, 8)],
      progress: [{ question_id: 1, progress: 0, learned: false }],
      grades: [jsonResponse({ question_id: 1, progress: 0.4, learned: false })],
    })
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    renderPracticePage()
    expect(await screen.findByRole('img', { name: 'Noch nicht gelernt' })).toBeInTheDocument()

    await revealAndGrade('Richtig')

    // Still on the graded question, boat already on its way.
    expect(await screen.findByRole('img', { name: 'Auf Kurs zu gelernt' })).toBeInTheDocument()
    expect(screen.getByText(/Frage 1 von 2/)).toBeInTheDocument()
    // Then the next question comes up.
    expect(await screen.findByText(/Frage 2 von 2/, {}, { timeout: 2000 })).toBeInTheDocument()
  })

  it('tells the learner when a grading sets the question back', async () => {
    mockBackend({
      progress: [{ question_id: 1, progress: 0.9, learned: false }],
      grades: [jsonResponse({ question_id: 1, progress: 0, learned: false })],
    })
    renderPracticePage()

    await revealAndGrade('Teilweise Richtig')

    expect(await screen.findByRole('status')).toHaveTextContent('Zurückgefallen')
  })

  it('keeps the assessment open when saving fails', async () => {
    mockBackend({ grades: [jsonResponse({ detail: 'boom' }, 500)] })
    renderPracticePage()

    await revealAndGrade('Falsch')

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Bewertung konnte nicht gespeichert werden.')
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeEnabled()
  })

  it('walks through a run and sums it up at the end', async () => {
    mockBackend({
      questions: [question(1, 7), question(2, 8), question(3, 9)],
      // Question 3 is already learned, so it isn't part of the run.
      progress: [
        { question_id: 2, progress: 0.9, learned: false },
        { question_id: 3, progress: 1, learned: true },
      ],
      grades: [
        jsonResponse({ question_id: 0, progress: 0, learned: false }),
        jsonResponse({ question_id: 0, progress: 1, learned: true }),
      ],
    })
    // Deterministic shuffle: the run becomes [question 8, question 7].
    vi.spyOn(Math, 'random').mockReturnValue(0)
    renderPracticePage()

    expect(await screen.findByText('Frage 1 von 2 · Nr. 8')).toBeInTheDocument()
    await revealAndGrade('Falsch')
    await waitFor(() => expect(screen.getByText('Frage 2 von 2 · Nr. 7')).toBeInTheDocument())
    expect(screen.getByRole('textbox')).toHaveFocus()
    await revealAndGrade('Richtig')
    expect(await screen.findByRole('status')).toHaveTextContent('Gelernt.')

    expect(screen.getByRole('heading', { name: 'Runde beendet' })).toBeInTheDocument()
    expect(screen.getByText('Neu gelernt').nextSibling).toHaveTextContent('1')
    expect(screen.getByText('Falsch').nextSibling).toHaveTextContent('1')

    expect(screen.queryByRole('button', { name: 'Neue Runde' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Zur Themenübersicht' })).toHaveAttribute('href', '/learn')
  })

  it('shows exactly one course gauge and report button after moving to the next question', async () => {
    mockBackend({
      questions: [question(1, 7), question(2, 8)],
      grades: [jsonResponse({ question_id: 1, progress: 0.4, learned: false })],
    })
    renderPracticePage()

    await revealAndGrade('Richtig')

    expect(await screen.findByText(/Frage 2 von 2/)).toBeInTheDocument()
    expect(screen.getAllByTestId('course-boat')).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Fehler in dieser Frage melden' })).toHaveLength(1)
  })

  it('runs the whole loop from the keyboard', async () => {
    const fetchMock = mockBackend({
      questions: [question(1, 7), question(2, 8)],
      grades: [jsonResponse({ question_id: 1, progress: 0, learned: false })],
    })
    vi.spyOn(Math, 'random').mockReturnValue(0)
    renderPracticePage()
    const user = userEvent.setup()

    const textbox = await screen.findByRole('textbox')
    await waitFor(() => expect(textbox).toHaveFocus())
    await user.keyboard('Zeile eins{Shift>}{Enter}{/Shift}Zeile zwei')
    expect(textbox).toHaveValue('Zeile eins\nZeile zwei')
    expect(screen.queryByText('Amtliche Antwort')).not.toBeInTheDocument()

    await user.keyboard('{Enter}')
    expect(await screen.findByText('Amtliche Antwort')).toBeInTheDocument()

    const focusOrder = ['Richtig', 'Teilweise Richtig', 'Falsch', 'Richtig']
    for (const name of focusOrder) {
      await user.tab()
      expect(screen.getByRole('radio', { name })).toHaveFocus()
    }
    expect(screen.getByRole('radio', { name: 'Richtig' })).not.toBeChecked()

    await user.tab()
    await user.keyboard('{Enter}')
    // Enter on an option saves it and goes straight to the next question, answer field focused.
    expect(await screen.findByText('Frage 2 von 2 · Nr. 7')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveFocus())
    expect(fetchMock).toHaveBeenCalled()
  })

  it('offers to repeat everything once the whole topic is learned', async () => {
    const user = userEvent.setup()
    mockBackend({ progress: [{ question_id: 1, progress: 1, learned: true }] })
    renderPracticePage()

    expect(await screen.findByRole('heading', { name: 'Alles gelernt' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Zur Themenübersicht' })).toHaveAttribute('href', '/learn')

    await user.click(screen.getByRole('button', { name: 'Alle Fragen wiederholen' }))
    expect(screen.getByRole('heading', { name: 'Frage 7?' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Gelernt' })).toBeInTheDocument()
  })

  it('says so when the topic has no questions', async () => {
    mockBackend({ questions: [] })
    renderPracticePage()

    expect(await screen.findByText('Zu diesem Thema gibt es keine Fragen.')).toBeInTheDocument()
  })

  it('shows an error when loading fails', async () => {
    mockBackend({ failLoad: true })
    renderPracticePage()

    expect(await screen.findByText('Die Fragen konnten nicht geladen werden.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Lernen' })).toBeInTheDocument()
  })
})
