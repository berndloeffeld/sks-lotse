import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '../store/authStore'
import { useUserRefreshOnReturn } from './useUserRefreshOnReturn'

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useUserRefreshOnReturn', () => {
  const refreshUser = vi.fn().mockResolvedValue(undefined)

  afterEach(() => {
    refreshUser.mockClear()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  })

  it('refreshes the user when the tab becomes visible again', () => {
    useAuthStore.setState({ refreshUser })
    renderHook(() => useUserRefreshOnReturn())

    setVisibility('visible')

    expect(refreshUser).toHaveBeenCalledTimes(1)
  })

  it('does not refresh when the tab is hidden', () => {
    useAuthStore.setState({ refreshUser })
    renderHook(() => useUserRefreshOnReturn())

    setVisibility('hidden')

    expect(refreshUser).not.toHaveBeenCalled()
  })

  it('stops listening once unmounted', () => {
    useAuthStore.setState({ refreshUser })
    const { unmount } = renderHook(() => useUserRefreshOnReturn())
    unmount()

    setVisibility('visible')

    expect(refreshUser).not.toHaveBeenCalled()
  })
})
