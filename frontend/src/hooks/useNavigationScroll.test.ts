import { act, renderHook } from '@testing-library/react'
import { createElement } from 'react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useNavigationScroll } from './useNavigationScroll'

function renderAt(path: string) {
  return renderHook(
    () => {
      useNavigationScroll()
      return useNavigate()
    },
    { wrapper: ({ children }) => createElement(MemoryRouter, { initialEntries: [path] }, children) },
  )
}

describe('useNavigationScroll', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('scrolls the element matching the hash into view', () => {
    const target = document.createElement('div')
    target.id = 'quelle'
    document.body.appendChild(target)
    const scrollIntoView = vi.fn()
    target.scrollIntoView = scrollIntoView

    renderAt('/faq#quelle')

    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    target.remove()
  })

  it('does nothing when no element matches the hash', () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    renderAt('/faq#does-not-exist')

    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('leaves the first load to the browser', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    renderAt('/faq')

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('starts a newly opened page at the top', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const { result } = renderAt('/imprint')

    act(() => result.current('/privacy'))

    expect(scrollTo).toHaveBeenCalledExactlyOnceWith(0, 0)
  })

  it('leaves back and forward to the browser', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const { result } = renderAt('/imprint')
    act(() => result.current('/privacy'))
    scrollTo.mockClear()

    act(() => result.current(-1))

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('keeps the scroll position when only the query changes, however often', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const { result } = renderAt('/learn')

    act(() => result.current('/learn?modus=focus', { replace: true }))
    act(() => result.current('/learn?modus=refresh', { replace: true }))
    act(() => result.current('/learn'))

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('still scrolls to the top after a query-only change when the page changes', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const { result } = renderAt('/learn')
    act(() => result.current('/learn?modus=focus', { replace: true }))

    act(() => result.current('/privacy'))

    expect(scrollTo).toHaveBeenCalledExactlyOnceWith(0, 0)
  })
})
