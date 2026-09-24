import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import type { Question, TopicProgress } from '../api/types'
import { useAuthStore } from '../store/authStore'
import { FocusPracticePage } from './FocusPracticePage'
import { jsonResponse } from '../test/fixtures'

function question(id: number, number: number, subject: string, topic: string): Question {
  return {
    id,
    subject,
    number,
    question_text: `Frage ${number}?`,
    answer_text: `Antwort ${number}.`,
    question_images: [],
    answer_images: [],
    topic,
  }
}

const summary: TopicProgress[] = [
  ['navigation', 'ankern', 'Ankern'],
  ['wetterkunde', 'wind', 'Wind'],
].map(([subject, topic_slug, topic_name], i) => ({
  subject,
  topic_slug,
  topic_name,
  display_order: i,
  total_questions: 5,
  learned_questions: 0,
  learning_questions: 0,
  is_focus: true,
}))

function mockBackend(questions: Question[], { failLoad = false } = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (failLoad) return jsonResponse({ detail: 'boom' }, 500)
    if (init?.method === 'POST' && url.includes('/progress/questions/')) {
      return jsonResponse({ question_id: 1, progress: 0.4, learned: false })
    }
    if (url.endsWith('/progress/focus/questions')) return jsonResponse(questions)
    if (url.endsWith('/progress/questions')) return jsonResponse([])
    if (url.endsWith('/progress/summary')) return jsonResponse(summary)
    return jsonResponse({ detail: 'not found' }, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPage() {
  return render(
    <MemoryRouter>
      <FocusPracticePage />
    </MemoryRouter>,
  )
}

describe('FocusPracticePage', () => {
  afterEach(() => {
    cleanup()
    useAuthStore.setState({ user: null })
  })

  it('plays the questions in the order the server sent, across topics', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    // Wetterkunde first although Navigation would sort first — and no shuffling.
    const fetchMock = mockBackend([question(2, 9, 'wetterkunde', 'wind'), question(1, 7, 'navigation', 'ankern')])
    renderPage()

    expect(await screen.findByText('Frage 9?')).toBeInTheDocument()
    expect(screen.getByText('Frage 1 von 2')).toBeInTheDocument()
    expect(screen.getByText('Wetterkunde (Wind) – Nr. 9')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Lösung anzeigen' }))
    await user.click(screen.getByRole('radio', { name: 'Richtig' }))
    await user.click(screen.getByRole('button', { name: 'Weiter' }))

    expect(await screen.findByText('Frage 7?')).toBeInTheDocument()
    expect(screen.getByText('Navigation (Ankern) – Nr. 7')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/progress/questions/2'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('says so when no Fokus question is open, without offering to repeat learned ones', async () => {
    mockBackend([])
    renderPage()

    expect(await screen.findByText('Es sind keine Fokus-Fragen offen.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Alle Fragen wiederholen' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Zur Themenübersicht' })).toHaveAttribute('href', '/learn')
  })

  it('shows an error when the questions cannot be loaded', async () => {
    mockBackend([], { failLoad: true })
    renderPage()

    expect(await screen.findByText('Die Fragen konnten nicht geladen werden.')).toBeInTheDocument()
  })

  it('falls back to the raw topic slug when the topic is not in the summary', async () => {
    mockBackend([question(3, 4, 'navigation', 'unbekannt')])
    renderPage()

    expect(await screen.findByText('Navigation (unbekannt) – Nr. 4')).toBeInTheDocument()
  })
})
