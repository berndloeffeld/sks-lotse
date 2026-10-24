import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { LEARNING_METHOD_FAQ } from '../faq'
import { useAuthStore } from '../../shared/store/authStore'
import { LearningMethodPage } from './LearningMethodPage'

function renderLearningMethodPage() {
  return render(
    <MemoryRouter>
      <LearningMethodPage />
    </MemoryRouter>,
  )
}

describe('LearningMethodPage', () => {
  it('explains the method without requiring a login', () => {
    renderLearningMethodPage()

    expect(
      screen.getByRole('heading', { level: 1, name: 'SKS-Fragenkatalog lernen mit dem Karteikarten-Prinzip' }),
    ).toBeInTheDocument()
    for (const name of [
      'Warum einmal Durchlesen nicht reicht',
      'Das Karteikarten-Prinzip',
      'So läuft eine Frage ab',
      'Die Halbwertszeit deiner Antworten',
      'Wann eine Frage als gelernt gilt',
      'Drei Wege durch den Katalog',
      'So holst du das Meiste heraus',
      'Ehrlich gesagt: eine Schätzung',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
  })

  it('names the three modes and links to Lernen and the exam process', () => {
    renderLearningMethodPage()

    for (const mode of ['Nach Thema:', 'Fokus:', 'Auffrischen:']) {
      expect(screen.getByText(mode)).toBeInTheDocument()
    }
    // The header also has a "Lernen" link.
    const main = within(screen.getByRole('main'))
    expect(main.getByRole('link', { name: 'Lernen' })).toHaveAttribute('href', '/learn')
    expect(main.getByRole('link', { name: 'So läuft die SKS-Prüfung ab' })).toHaveAttribute('href', '/exam-process')
    expect(main.getByRole('link', { name: 'häufigen Fragen' })).toHaveAttribute('href', '/faq')
  })

  it('shows no number of the half-life model, as the course gauge never does (ADR-0024)', () => {
    renderLearningMethodPage()

    const text = screen.getByRole('main').textContent ?? ''
    expect(text).not.toMatch(/\d+\s*(Tage|%|Prozent)/)
    expect(text).not.toMatch(/0[,.]7|2[,.]5|dreimal|drei Mal/)
  })

  it('is honest that the half-life is an estimate', () => {
    renderLearningMethodPage()

    expect(screen.getByText(/kein gemessener Wert/)).toBeInTheDocument()
    expect(screen.getByText(/keine Garantie fürs Bestehen/)).toBeInTheDocument()
  })

  it('illustrates the method with three figures, each with a caption', () => {
    renderLearningMethodPage()

    const figures = screen.getAllByRole('figure')
    expect(figures).toHaveLength(3)
    for (const figure of figures) {
      expect(within(figure).getByRole('img')).toBeInTheDocument()
      expect(figure.querySelector('figcaption')).not.toBeEmptyDOMElement()
    }
  })

  it('shows the short answers that also go into the FAQPage markup', () => {
    renderLearningMethodPage()

    for (const { question, answer } of LEARNING_METHOD_FAQ) {
      expect(screen.getByRole('heading', { level: 3, name: question })).toBeInTheDocument()
      expect(screen.getByText(answer)).toBeInTheDocument()
    }
  })

  it('invites a guest to sign up', () => {
    useAuthStore.setState({ isAuthenticated: false })
    renderLearningMethodPage()

    expect(screen.getByRole('link', { name: 'Kostenlos anmelden' })).toHaveAttribute('href', '/login')
  })

  it('takes a learner straight to learning', () => {
    useAuthStore.setState({ isAuthenticated: true })
    renderLearningMethodPage()

    expect(screen.getByRole('link', { name: 'Zum Lernen' })).toHaveAttribute('href', '/learn')
    expect(screen.queryByRole('link', { name: 'Kostenlos anmelden' })).not.toBeInTheDocument()
    useAuthStore.setState({ isAuthenticated: false })
  })
})
