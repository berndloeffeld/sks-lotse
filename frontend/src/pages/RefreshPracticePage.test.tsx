import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import type { Question, QuestionProgress, TopicProgress } from '../api/types'
import { RefreshPracticePage } from './RefreshPracticePage'
import { jsonResponse } from '../test/fixtures'

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

const summary: TopicProgress[] = [
  {
    subject: 'navigation',
    topic_slug: 'ankern',
    topic_name: 'Ankern',
    display_order: 1,
    total_questions: 5,
    learned_questions: 2,
    learning_questions: 0,
    is_focus: false,
  },
]

// Both questions are still gelernt (about to lapse): the run must not filter them out.
const standings: QuestionProgress[] = [1, 2].map((question_id) => ({ question_id, progress: 1, learned: true }))

function mockBackend(questions: Question[], { failLoad = false } = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (failLoad) return jsonResponse({ detail: 'boom' }, 500)
    if (init?.method === 'POST' && url.includes('/progress/questions/')) {
      return jsonResponse({ question_id: 1, progress: 1, learned: true })
    }
    if (url.endsWith('/progress/refresh/questions')) return jsonResponse(questions)
    if (url.endsWith('/progress/questions')) return jsonResponse(standings)
    if (url.endsWith('/progress/summary')) return jsonResponse(summary)
    return jsonResponse({ detail: 'not found' }, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPage() {
  return render(
    <MemoryRouter>
      <RefreshPracticePage />
    </MemoryRouter>,
  )
}

describe('RefreshPracticePage', () => {
  afterEach(cleanup)

  it('plays the sent questions in order, although they are still gelernt', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const fetchMock = mockBackend([question(2, 9), question(1, 7)])
    renderPage()

    expect(await screen.findByText('Frage 9?')).toBeInTheDocument()
    expect(screen.getByText('Frage 1 von 2')).toBeInTheDocument()
    expect(screen.getByText('Navigation (Ankern) – Nr. 9')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Lösung anzeigen' }))
    await user.click(screen.getByRole('radio', { name: 'Richtig' }))
    await user.click(screen.getByRole('button', { name: 'Weiter' }))

    expect(await screen.findByText('Frage 7?')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/progress/questions/2'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('says nothing is lapsing when the session is empty, without offering to repeat everything', async () => {
    mockBackend([])
    renderPage()

    expect(await screen.findByText('Nichts aufzufrischen')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Alle Fragen wiederholen' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Zur Themenübersicht' })).toHaveAttribute('href', '/learn')
  })

  it('shows an error when the questions cannot be loaded', async () => {
    mockBackend([], { failLoad: true })
    renderPage()

    expect(await screen.findByText('Die Fragen konnten nicht geladen werden.')).toBeInTheDocument()
  })

  it('falls back to the raw topic slug when the topic is not in the summary', async () => {
    mockBackend([{ ...question(1, 4), topic: 'unbekannt' }])
    renderPage()

    expect(await screen.findByText('Navigation (unbekannt) – Nr. 4')).toBeInTheDocument()
  })
})
