import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '../store/authStore'
import { makeUser } from '../test/fixtures'
import { ChartExercisesGate } from './ChartExercisesGate'

function renderGate() {
  return render(
    <MemoryRouter initialEntries={['/charts']}>
      <Routes>
        <Route element={<ChartExercisesGate />}>
          <Route path="/charts" element={<p>Kartenaufgaben</p>} />
        </Route>
        <Route path="/learn" element={<p>Lernen</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ChartExercisesGate', () => {
  it('lets a learner the flag covers through', () => {
    useAuthStore.setState({ user: makeUser({ can_use_chart_exercises: true }), isAuthenticated: true })
    renderGate()
    expect(screen.getByText('Kartenaufgaben')).toBeInTheDocument()
  })

  it('sends everyone else to /learn', () => {
    useAuthStore.setState({ user: makeUser(), isAuthenticated: true })
    renderGate()
    expect(screen.getByText('Lernen')).toBeInTheDocument()
  })

  it('lets guests through while the build’s flag is on', () => {
    vi.stubEnv('VITE_CHART_EXERCISES', 'on')
    useAuthStore.setState({ user: null, isAuthenticated: false })
    renderGate()
    expect(screen.getByText('Kartenaufgaben')).toBeInTheDocument()
  })

  it('keeps the API’s word for a logged-in learner even when the build’s flag is on', () => {
    vi.stubEnv('VITE_CHART_EXERCISES', 'on')
    useAuthStore.setState({ user: makeUser(), isAuthenticated: true })
    renderGate()
    expect(screen.getByText('Lernen')).toBeInTheDocument()
  })

  it('treats a missing user as not covered', () => {
    vi.stubEnv('VITE_CHART_EXERCISES', 'admins')
    useAuthStore.setState({ user: null, isAuthenticated: false })
    renderGate()
    expect(screen.getByText('Lernen')).toBeInTheDocument()
  })
})
