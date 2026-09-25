import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MFA_REQUIRED, apiClient } from '../api/client'
import { jsonResponse } from '../test/fixtures'
import { useAdminMfaStatus } from './useAdminMfaStatus'

// The real client with a stubbed fetch, so the "mfa_required" path runs through the actual handler.
function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn()
  for (const response of responses) fetchMock.mockResolvedValueOnce(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('useAdminMfaStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads the status of the session', async () => {
    const fetchMock = stubFetch(jsonResponse({ enrolled: true, verified: false }))
    const { result } = renderHook(() => useAdminMfaStatus())

    await waitFor(() => expect(result.current.status).toEqual({ enrolled: true, verified: false }))
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/v1\/admin\/mfa\/status$/)
    expect(result.current.failed).toBe(false)
  })

  it('reports a failed load', async () => {
    stubFetch(jsonResponse({ detail: 'boom' }, 500))
    const { result } = renderHook(() => useAdminMfaStatus())

    await waitFor(() => expect(result.current.failed).toBe(true))
    expect(result.current.status).toBeUndefined()
  })

  it('reloads the status when an admin call asks for the second factor again', async () => {
    stubFetch(
      jsonResponse({ enrolled: true, verified: true }),
      jsonResponse({ detail: MFA_REQUIRED }, 403),
      jsonResponse({ enrolled: true, verified: false }),
    )
    const { result } = renderHook(() => useAdminMfaStatus())
    await waitFor(() => expect(result.current.status?.verified).toBe(true))

    await apiClient.get('/admin/users').catch(() => {})

    await waitFor(() => expect(result.current.status?.verified).toBe(false))
  })

  it('stops listening once unmounted', async () => {
    const fetchMock = stubFetch(
      jsonResponse({ enrolled: true, verified: true }),
      jsonResponse({ detail: MFA_REQUIRED }, 403),
    )
    const { result, unmount } = renderHook(() => useAdminMfaStatus())
    await waitFor(() => expect(result.current.status).toBeDefined())
    unmount()

    await apiClient.get('/admin/users').catch(() => {})

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
