import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import indexHtml from '../../index.html?raw'

function wrapperAt(path: string) {
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
  )
}

describe('useDocumentTitle', () => {
  beforeEach(() => {
    vi.resetModules()
    document.body.innerHTML = '<div id="root"></div>'
    document.title = 'Prerendered'
  })

  it('sets the title after a client-side navigation', async () => {
    const { useDocumentTitle } = await import('./useDocumentTitle')
    renderHook(() => useDocumentTitle('FAQ – SKS Lotse'), { wrapper: wrapperAt('/faq') })
    expect(document.title).toBe('FAQ – SKS Lotse')
  })

  it('keeps the prerendered title of the page that was loaded directly, but only on that first render', async () => {
    document.getElementById('root')!.dataset.prerendered = '/faq'
    const { useDocumentTitle } = await import('./useDocumentTitle')
    renderHook(() => useDocumentTitle('FAQ – SKS Lotse'), { wrapper: wrapperAt('/faq') })
    expect(document.title).toBe('Prerendered')

    renderHook(() => useDocumentTitle('FAQ – SKS Lotse'), { wrapper: wrapperAt('/faq') })
    expect(document.title).toBe('FAQ – SKS Lotse')
  })

  it('uses the home title index.html has', async () => {
    const { HOME_TITLE } = await import('./useDocumentTitle')
    expect(indexHtml).toContain(`<title>${HOME_TITLE}</title>`)
  })
})
