import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'

const ADSENSE_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-123'
const RELOAD_KEY = 'sks-lotse:ad-free-reload'

function adScripts() {
  return document.head.querySelectorAll('script[src*="adsbygoogle.js"]')
}

// The gate reads the served document once, at module load — so each case sets the document up the
// way the served HTML would and then loads a fresh copy of the module.
async function renderAt(
  path: string,
  { staticTag = false, arrivedByReload = false }: { staticTag?: boolean; arrivedByReload?: boolean } = {},
) {
  vi.resetModules()
  if (staticTag) {
    const script = document.createElement('script')
    script.src = ADSENSE_SRC
    document.head.append(script)
  }
  if (arrivedByReload) window.sessionStorage.setItem(RELOAD_KEY, '1')
  const { AdScriptGate } = await import('./AdScriptGate')
  const { useAuthStore: store } = await import('../store/authStore')
  const reload = vi.fn()
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AdScriptGate reload={reload} />}>
          <Route path="/login" element={<p>Login page</p>} />
          <Route path="/start" element={<p>Start page</p>} />
          <Route path="/admin" element={<p>Admin page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
  return { reload, store, view }
}

function signedIn(adsRemoved: boolean, store = useAuthStore) {
  store.setState({
    isLoading: false,
    isAuthenticated: true,
    user: { id: 1, email: 'l@example.com', ads_removed: adsRemoved } as never,
  })
}

describe('AdScriptGate', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ADSENSE_CLIENT_ID', 'ca-pub-123')
  })

  afterEach(() => {
    document.head.querySelectorAll('script').forEach((script) => script.remove())
    window.sessionStorage.clear()
    vi.unstubAllEnvs()
    useAuthStore.setState({ isLoading: true, isAuthenticated: false, user: null })
  })

  it('waits for the session check before deciding', async () => {
    const { reload } = await renderAt('/start', { staticTag: false })

    expect(adScripts()).toHaveLength(0)
    expect(reload).not.toHaveBeenCalled()
    expect(screen.getByText('Start page')).toBeInTheDocument()
  })

  it('loads the script for an account that sees ads', async () => {
    const { store } = await renderAt('/start')
    signedIn(false, store)

    await vi.waitFor(() => expect(adScripts()).toHaveLength(1))
    expect(screen.getByText('Start page')).toBeInTheDocument()
  })

  it('loads the script on the login page for anonymous visitors', async () => {
    const { store } = await renderAt('/login')
    store.setState({ isLoading: false, isAuthenticated: false, user: null })

    await vi.waitFor(() => expect(adScripts()).toHaveLength(1))
  })

  it('never loads the script for an account that removed ads', async () => {
    const { store, reload } = await renderAt('/start')
    signedIn(true, store)

    await screen.findByText('Start page')
    expect(adScripts()).toHaveLength(0)
    expect(reload).not.toHaveBeenCalled()
  })

  it('never loads the script on the admin tools', async () => {
    const { store } = await renderAt('/admin')
    signedIn(false, store)

    await screen.findByText('Admin page')
    expect(adScripts()).toHaveLength(0)
  })

  it('does nothing when no publisher id is configured', async () => {
    vi.stubEnv('VITE_ADSENSE_CLIENT_ID', '')
    const { store } = await renderAt('/start')
    signedIn(false, store)

    await screen.findByText('Start page')
    expect(adScripts()).toHaveLength(0)
  })

  it('leaves a document with the script before rendering the admin tools', async () => {
    const { store, reload } = await renderAt('/admin', { staticTag: true })
    signedIn(false, store)

    await vi.waitFor(() => expect(reload).toHaveBeenCalledWith(window.location.href))
    expect(screen.queryByText('Admin page')).not.toBeInTheDocument()
    expect(window.sessionStorage.getItem(RELOAD_KEY)).toBe('1')
  })

  it('leaves a document with the script when the account removed ads', async () => {
    const { store, reload } = await renderAt('/start', { staticTag: true })
    signedIn(true, store)

    await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce())
  })

  it('stays put instead of looping when the reload landed on a page served with the tag', async () => {
    const { store, reload } = await renderAt('/admin', { staticTag: true, arrivedByReload: true })
    signedIn(false, store)

    await screen.findByText('Admin page')
    expect(reload).not.toHaveBeenCalled()
    expect(window.sessionStorage.getItem(RELOAD_KEY)).toBeNull()
  })

  it('still leaves a script it injected itself after an earlier reload', async () => {
    // Earlier reload landed here without a static tag; then the learner used the app (script
    // injected) and now opens /admin — that must reload again, the loop guard doesn't apply.
    const { store, reload, view } = await renderAt('/start', { arrivedByReload: true })
    signedIn(false, store)
    await vi.waitFor(() => expect(adScripts()).toHaveLength(1))
    view.unmount()

    const { AdScriptGate } = await import('./AdScriptGate')
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<AdScriptGate reload={reload} />}>
            <Route path="/admin" element={<p>Admin page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(reload).toHaveBeenCalledOnce()
  })
})
