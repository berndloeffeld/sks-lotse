import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiClient, setUnauthorizedHandler } from './client'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('apiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setUnauthorizedHandler(() => {})
  })

  it('GET sends credentials and returns parsed JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await apiClient.get<{ status: string }>('/health')

    expect(result).toEqual({ status: 'ok' })
    const [, init] = fetchMock.mock.calls[0]
    expect(init.credentials).toBe('include')
  })

  it('POST serializes the body as JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ detail: 'sent' }, 202))
    vi.stubGlobal('fetch', fetchMock)

    await apiClient.post('/auth/otp/request', { email: 'learner@example.com' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/api/v1/auth/otp/request')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ email: 'learner@example.com' }))
  })

  it('returns undefined for a 204 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))

    const result = await apiClient.post('/auth/logout')

    expect(result).toBeUndefined()
  })

  it('throws an ApiError carrying the backend detail message and status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'Invalid or expired code' }, 401)))

    try {
      await apiClient.post('/auth/otp/verify', { email: 'x', code: '000000' })
      expect.unreachable('expected apiClient.post to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect((err as ApiError).status).toBe(401)
      expect((err as ApiError).message).toBe('Invalid or expired code')
    }
  })

  it('falls back to the status text when the error body has no detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('not json', { status: 500, statusText: 'Server Error' })),
    )

    await expect(apiClient.get('/questions')).rejects.toMatchObject({ status: 500, message: 'Server Error' })
  })

  it('calls the registered unauthorized handler on a 401', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'Not authenticated' }, 401)))

    await apiClient.get('/auth/me').catch(() => {})

    expect(handler).toHaveBeenCalledOnce()
  })
})
