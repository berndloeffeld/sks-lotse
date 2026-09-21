import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import type { ExamSummary } from '../api/types'
import { useAuthStore } from '../store/authStore'
import { jsonResponse } from '../test/examFixtures'
import { ExamPage } from './ExamPage'

function summary(overrides: Partial<ExamSummary>): ExamSummary {
  return {
    id: 1,
    status: 'completed',
    exam_variant: 'motor',
    started_at: '2026-09-01T10:00:00Z',
    submitted_at: '2026-09-01T11:00:00Z',
    timed_out: false,
    answered_count: 30,
    question_count: 30,
    points: 44,
    max_points: 60,
    result: 'bestanden',
    ...overrides,
  }
}

function setUser(examVariant: string | null) {
  useAuthStore.setState({
    user: {
      id: 1,
      email: 'a@example.com',
      created_at: '2026-01-01T00:00:00Z',
      exam_variant: examVariant,
      first_name: null,
      last_name: null,
      gender: null,
      ai_grading_enabled: false,
      ads_removed: false,
      ai_checks_remaining: 20,
      is_admin: false,
    },
    isAuthenticated: true,
    isLoading: false,
  })
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/exam']}>
      <Routes>
        <Route path="/exam" element={<ExamPage />} />
        <Route path="/exam/:id" element={<p>Prüfung Nr. geöffnet</p>} />
        <Route path="/profile" element={<p>Profil</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ExamPage', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('states the rules and lists earlier exams with their result', async () => {
    setUser('motor')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse([summary({ id: 2, status: 'grading', points: null, result: null }), summary({ id: 1 })]),
      ),
    )
    renderPage()

    expect(screen.getByText(/30 Fragen/)).toBeInTheDocument()
    expect(screen.getByText(/ohne Tipps/)).toBeInTheDocument()
    expect(await screen.findByText('44 / 60 · Bestanden')).toBeInTheDocument()
    expect(screen.getByText('Selbsteinschätzung offen')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /2026/ })[0]).toHaveAttribute('href', '/exam/2')
    expect(screen.getByRole('button', { name: 'Prüfung starten' })).toBeEnabled()
  })

  it('starts an exam and opens it', async () => {
    setUser('motor')
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === 'POST' ? jsonResponse({ id: 9 }, 201) : jsonResponse([]),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderPage()

    expect(await screen.findByText('Noch keine Prüfung abgelegt.')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Prüfung starten' }))
    expect(await screen.findByText('Prüfung Nr. geöffnet')).toBeInTheDocument()
  })

  it('offers to resume a running exam instead of starting another', async () => {
    setUser('motor')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([summary({ id: 5, status: 'in_progress', points: null, result: null })])),
    )
    renderPage()
    expect(await screen.findByRole('link', { name: 'Laufende Prüfung fortsetzen' })).toHaveAttribute('href', '/exam/5')
    expect(screen.queryByRole('button', { name: 'Prüfung starten' })).not.toBeInTheDocument()
  })

  it('asks for an exam variant first', async () => {
    setUser(null)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([])),
    )
    renderPage()
    expect(await screen.findByText(/Wähle zuerst in deinem/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Prüfung starten' })).not.toBeInTheDocument()
  })

  it('reports a failed start, including the "already running" conflict', async () => {
    setUser('motor')
    let status = 409
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'POST' ? jsonResponse({ detail: 'x' }, status) : jsonResponse([]),
      ),
    )
    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Prüfung starten' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Es läuft bereits eine Prüfung')
    status = 503
    await user.click(screen.getByRole('button', { name: 'Prüfung starten' }))
    expect(await screen.findByText('Die Prüfung konnte nicht gestartet werden.')).toBeInTheDocument()
  })

  it('reports a failed load', async () => {
    setUser('motor')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ detail: 'x' }, 500)),
    )
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Prüfungen konnten nicht geladen werden.')
  })
})
