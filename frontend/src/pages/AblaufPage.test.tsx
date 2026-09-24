import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { AblaufPage } from './AblaufPage'

function renderAblaufPage() {
  return render(
    <MemoryRouter>
      <AblaufPage />
    </MemoryRouter>,
  )
}

describe('AblaufPage', () => {
  it('renders the process overview without requiring a login', () => {
    renderAblaufPage()

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

  it('is honest that SKS Lotse only covers the theory question sheet, not the chart task or the practical exam', () => {
    renderAblaufPage()

    expect(screen.getByText(/SKS Lotse hilft dir dabei bisher nicht/)).toBeInTheDocument()
    expect(screen.getByText(/SKS Lotse deckt ausschließlich die Theorie ab/)).toBeInTheDocument()
  })

  it('links back into the app', () => {
    renderAblaufPage()

    expect(screen.getByRole('link', { name: 'Jetzt kostenlos lernen' })).toHaveAttribute('href', '/#anmelden')
  })
})
