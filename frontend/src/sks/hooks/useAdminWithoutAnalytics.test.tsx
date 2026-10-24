import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAdminWithoutAnalytics } from './useAdminWithoutAnalytics'

function renderAt(path: string, reload: (url: string) => void) {
  return renderHook(() => useAdminWithoutAnalytics(reload), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>,
  })
}

function addScript() {
  const script = document.createElement('script')
  script.dataset.websiteId = 'x'
  document.head.append(script)
}

describe('useAdminWithoutAnalytics', () => {
  afterEach(() => {
    document.head.querySelector('script[data-website-id]')?.remove()
  })

  it('reloads on the admin tools when the document runs the script', () => {
    addScript()
    const reload = vi.fn()

    renderAt('/admin/users', reload)

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('leaves an admin document without the script alone', () => {
    const reload = vi.fn()

    renderAt('/admin', reload)

    expect(reload).not.toHaveBeenCalled()
  })

  it('leaves other pages alone, script or not', () => {
    addScript()
    const reload = vi.fn()

    renderAt('/pricing', reload)

    expect(reload).not.toHaveBeenCalled()
  })
})
