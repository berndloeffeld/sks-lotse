import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { useLeaveConfirmation } from './useLeaveConfirmation'

function Guarded({ initiallyActive }: { initiallyActive: boolean }) {
  const [active, setActive] = useState(initiallyActive)
  const blocker = useLeaveConfirmation(active)
  return (
    <>
      <p>Blocker: {blocker.state}</p>
      <button type="button" onClick={() => setActive((value) => !value)}>
        Umschalten
      </button>
      {blocker.state === 'blocked' ? (
        <>
          <button type="button" onClick={blocker.proceed}>
            Verlassen
          </button>
          <button type="button" onClick={blocker.reset}>
            Bleiben
          </button>
        </>
      ) : null}
    </>
  )
}

function renderGuarded(initiallyActive: boolean) {
  const router = createMemoryRouter(
    [
      { path: '/run', element: <Guarded initiallyActive={initiallyActive} /> },
      { path: '/elsewhere', element: <p>Elsewhere</p> },
    ],
    { initialEntries: ['/run'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

// BeforeUnloadEvent has no constructor; the browser makes it, here the legacy way.
function unload(): BeforeUnloadEvent {
  const event = document.createEvent('BeforeUnloadEvent')
  event.initEvent('beforeunload', false, true)
  window.dispatchEvent(event)
  return event
}

describe('useLeaveConfirmation', () => {
  it('lets every navigation and the tab go while inactive', async () => {
    const router = renderGuarded(false)

    expect(unload().defaultPrevented).toBe(false)
    await act(() => router.navigate('/elsewhere'))
    expect(screen.getByText('Elsewhere')).toBeInTheDocument()
  })

  it('has the browser ask before the tab is closed or reloaded while active', () => {
    const addListener = vi.spyOn(window, 'addEventListener')
    renderGuarded(true)

    expect(unload().defaultPrevented).toBe(true)
    // jsdom reads returnValue back as the legacy boolean, so the handler gets a stand-in here.
    const [, warn] = addListener.mock.calls.find(([type]) => type === 'beforeunload')!
    const event = { preventDefault: vi.fn(), returnValue: undefined as unknown }
    ;(warn as unknown as (event: object) => void)(event)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(event.returnValue).toBe(true)
    addListener.mockRestore()
  })

  it('stops asking the browser once inactive again', async () => {
    const user = userEvent.setup()
    renderGuarded(true)

    await user.click(screen.getByRole('button', { name: 'Umschalten' }))

    expect(unload().defaultPrevented).toBe(false)
  })

  it('holds a navigation to another page until it is confirmed', async () => {
    const user = userEvent.setup()
    const router = renderGuarded(true)

    await act(() => router.navigate('/elsewhere'))
    expect(screen.getByText('Blocker: blocked')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/run')

    await user.click(screen.getByRole('button', { name: 'Verlassen' }))
    expect(await screen.findByText('Elsewhere')).toBeInTheDocument()
  })

  it('stays when the navigation is called off', async () => {
    const user = userEvent.setup()
    const router = renderGuarded(true)

    await act(() => router.navigate('/elsewhere'))
    await user.click(screen.getByRole('button', { name: 'Bleiben' }))

    expect(screen.getByText('Blocker: unblocked')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/run')
  })

  it('holds a change of the query, but not of the anchor alone', async () => {
    const router = renderGuarded(true)

    await act(() => router.navigate('/run#task-2'))
    expect(screen.getByText('Blocker: unblocked')).toBeInTheDocument()
    expect(router.state.location.hash).toBe('#task-2')

    await act(() => router.navigate('/run?other=1'))
    expect(screen.getByText('Blocker: blocked')).toBeInTheDocument()
    expect(router.state.location.search).toBe('')
  })

  it('lets a held navigation go on its own once there is nothing left to lose', async () => {
    const user = userEvent.setup()
    const router = renderGuarded(true)

    await act(() => router.navigate('/elsewhere'))
    await user.click(screen.getByRole('button', { name: 'Umschalten' }))

    expect(screen.getByText('Blocker: unblocked')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/run')
  })
})
