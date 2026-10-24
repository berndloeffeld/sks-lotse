import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSectionSeen } from './useSectionSeen'

type Callback = (entries: Pick<IntersectionObserverEntry, 'isIntersecting'>[]) => void

let observers: {
  callback: Callback
  options?: IntersectionObserverInit
  observe: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}[]

function render(enabled = true) {
  const element = document.createElement('section')
  return renderHook(() => {
    const ref = useSectionSeen<HTMLElement>('landing_section_seen', 'faq', enabled)
    ref.current = element
    return ref
  })
}

describe('useSectionSeen', () => {
  beforeEach(() => {
    observers = []
    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn(function (this: unknown, callback: Callback, options?: IntersectionObserverInit) {
        const observer = { callback, options, observe: vi.fn(), disconnect: vi.fn() }
        observers.push(observer)
        return observer
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete window.umami
  })

  it('counts the section once it reaches the middle of the screen, then stops watching', () => {
    const track = vi.fn()
    window.umami = { track }
    render()

    const [observer] = observers
    expect(observer.observe).toHaveBeenCalledOnce()
    expect(observer.options).toEqual({ rootMargin: '0px 0px -50% 0px' })

    observer.callback([{ isIntersecting: false }])
    expect(track).not.toHaveBeenCalled()
    expect(observer.disconnect).not.toHaveBeenCalled()

    observer.callback([{ isIntersecting: true }])
    expect(track).toHaveBeenCalledExactlyOnceWith('landing_section_seen', { section: 'faq' })
    expect(observer.disconnect).toHaveBeenCalledOnce()
  })

  it('stops watching when unmounted', () => {
    const { unmount } = render()
    unmount()
    expect(observers[0].disconnect).toHaveBeenCalledOnce()
  })

  it('watches nothing while disabled', () => {
    render(false)
    expect(observers).toEqual([])
  })

  it('does nothing without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    expect(() => render()).not.toThrow()
  })
})
