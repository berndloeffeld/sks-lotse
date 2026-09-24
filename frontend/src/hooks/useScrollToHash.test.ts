import { renderHook } from '@testing-library/react'
import { createElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { useScrollToHash } from './useScrollToHash'

function renderAt(path: string) {
  return renderHook(() => useScrollToHash(), {
    wrapper: ({ children }) => createElement(MemoryRouter, { initialEntries: [path] }, children),
  })
}

describe('useScrollToHash', () => {
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

  it('does nothing when there is no hash', () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    renderAt('/faq')

    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('does nothing when no element matches the hash', () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    renderAt('/faq#does-not-exist')

    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})
