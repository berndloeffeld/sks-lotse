import { afterEach, describe, expect, it, vi } from 'vitest'

import { scrollBelowIntoView } from './scroll'

describe('scrollBelowIntoView', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does nothing without an element', () => {
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
    scrollBelowIntoView(null)
    expect(scrollBy).not.toHaveBeenCalled()
  })

  it('does nothing once the bottom edge, plus the margin, already clears the viewport', () => {
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
    const el = document.createElement('div')
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ bottom: window.innerHeight - 2 } as DOMRect)
    scrollBelowIntoView(el)
    expect(scrollBy).not.toHaveBeenCalled()
  })

  it('scrolls down exactly enough to clear the bottom edge, plus the margin', () => {
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
    const el = document.createElement('div')
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ bottom: window.innerHeight + 100 } as DOMRect)
    scrollBelowIntoView(el, 5)
    expect(scrollBy).toHaveBeenCalledWith({ top: 105, behavior: 'smooth' })
  })
})
