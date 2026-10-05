import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { useNavigateWhileMounted } from './useNavigateWhileMounted'

type Navigate = ReturnType<typeof useNavigateWhileMounted>

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function Page({ capture }: { capture: (navigate: Navigate) => void }) {
  capture(useNavigateWhileMounted())
  return <p>Seite</p>
}

function setup() {
  let navigate!: Navigate
  const view = render(
    <MemoryRouter initialEntries={['/a']}>
      <Where />
      <Routes>
        <Route path="/a" element={<Page capture={(n) => (navigate = n)} />} />
        <Route path="/b" element={<p>Ziel</p>} />
        <Route path="/c" element={<p>Anderswo</p>} />
      </Routes>
    </MemoryRouter>,
  )
  return { view, navigate: () => navigate }
}

describe('useNavigateWhileMounted', () => {
  it('navigates while the component is mounted', async () => {
    const { navigate } = setup()

    await act(async () => navigate()('/b'))

    expect(screen.getByTestId('where')).toHaveTextContent('/b')
  })

  it('does nothing once the component has unmounted', async () => {
    const { navigate } = setup()
    const late = navigate()
    // The learner moves on; the page unmounts.
    await act(async () => navigate()('/c'))

    await act(async () => late('/b'))

    expect(screen.getByTestId('where')).toHaveTextContent('/c')
  })
})
