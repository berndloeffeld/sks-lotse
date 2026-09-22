import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const ADSENSE_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-123'

// The component decides once per document, at module load — so each case loads a fresh copy of it
// after setting up the document the way the served HTML would.
async function renderInDocument({
  withAdScript,
  arrivedByReload = false,
}: {
  withAdScript: boolean
  arrivedByReload?: boolean
}) {
  vi.resetModules()
  if (withAdScript) {
    const script = document.createElement('script')
    script.src = ADSENSE_SRC
    document.head.append(script)
  }
  if (arrivedByReload) window.sessionStorage.setItem('sks-lotse:ad-free-reload', '1')
  const { AdFreeDocument } = await import('./AdFreeDocument')
  const reload = vi.fn()
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route element={<AdFreeDocument reload={reload} />}>
          <Route path="/login" element={<p>Login page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
  return reload
}

describe('AdFreeDocument', () => {
  afterEach(() => {
    document.head.querySelectorAll('script').forEach((script) => script.remove())
    window.sessionStorage.clear()
  })

  it('renders its routes in a document without the ad script', async () => {
    const reload = await renderInDocument({ withAdScript: false })

    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(reload).not.toHaveBeenCalled()
  })

  it('leaves a document that loaded the ad script before anything is rendered', async () => {
    const reload = await renderInDocument({ withAdScript: true })

    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
    expect(reload).toHaveBeenCalledWith(window.location.href)
    expect(window.sessionStorage.getItem('sks-lotse:ad-free-reload')).toBe('1')
  })

  it('renders anyway instead of looping when the reload landed in a document with the script', async () => {
    const reload = await renderInDocument({ withAdScript: true, arrivedByReload: true })

    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(reload).not.toHaveBeenCalled()
    expect(window.sessionStorage.getItem('sks-lotse:ad-free-reload')).toBeNull()
  })

  it('clears a leftover marker even in a document without the script', async () => {
    await renderInDocument({ withAdScript: false, arrivedByReload: true })

    expect(window.sessionStorage.getItem('sks-lotse:ad-free-reload')).toBeNull()
  })
})
