import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { EXAM_PROCESS_FAQ } from '../faq'
import { useAuthStore } from '../store/authStore'
import { ExamProcessPage } from './ExamProcessPage'

function renderExamProcessPage() {
  return render(
    <MemoryRouter>
      <ExamProcessPage />
    </MemoryRouter>,
  )
}

describe('ExamProcessPage', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders the process overview without requiring a login', () => {
    renderExamProcessPage()

    expect(screen.getByRole('heading', { level: 1, name: 'So läuft die SKS-Prüfung ab' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Der Weg zum Sportküstenschifferschein auf einen Blick' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Was du vor der SKS-Prüfung schon mitbringen musst' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'So läuft die SKS-Theorieprüfung ab' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Die Karten- und Gezeitenaufgabe' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'So läuft die SKS-Praxisprüfung ab' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Warum sich der SKS lohnt' })).toBeInTheDocument()
  })

  it('is honest that SKS Lotse does not cover the chart task while the Kartenaufgaben are closed, nor the practical exam', () => {
    vi.stubEnv('VITE_CHART_EXERCISES', 'off')
    renderExamProcessPage()

    expect(screen.getByText(/SKS Lotse hilft dir dabei bisher nicht/)).toBeInTheDocument()
    expect(within(screen.getByRole('main')).queryByRole('link', { name: 'Kartenaufgaben' })).not.toBeInTheDocument()
    expect(screen.getByText(/SKS Lotse deckt ausschließlich die Theorie ab/)).toBeInTheDocument()
  })

  it('points to the Kartenaufgaben once they are open', () => {
    vi.stubEnv('VITE_CHART_EXERCISES', 'on')
    renderExamProcessPage()

    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Kartenaufgaben' })).toHaveAttribute(
      'href',
      '/charts',
    )
    expect(screen.queryByText(/SKS Lotse hilft dir dabei bisher nicht/)).not.toBeInTheDocument()
  })

  it('shows the short answers that also go into the FAQPage markup', () => {
    renderExamProcessPage()

    for (const { question, answer } of EXAM_PROCESS_FAQ) {
      expect(screen.getByRole('heading', { level: 3, name: question })).toBeInTheDocument()
      expect(screen.getByText(answer)).toBeInTheDocument()
    }
  })

  it('invites a guest to sign up', () => {
    useAuthStore.setState({ isAuthenticated: false })
    renderExamProcessPage()

    expect(screen.getByRole('link', { name: 'Kostenlos anmelden' })).toHaveAttribute('href', '/login')
  })

  it('takes a learner straight to learning, without a login', () => {
    useAuthStore.setState({ isAuthenticated: true })
    renderExamProcessPage()

    expect(screen.getByRole('link', { name: 'Zum Lernen' })).toHaveAttribute('href', '/learn')
    expect(screen.queryByRole('link', { name: 'Kostenlos anmelden' })).not.toBeInTheDocument()
    useAuthStore.setState({ isAuthenticated: false })
  })
})
