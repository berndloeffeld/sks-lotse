import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiClient, setMaintenanceHandler, setUnauthorizedHandler } from './client'
import { jsonResponse } from '../test/fixtures'

describe('apiClient', () => {
  afterEach(() => {
    setUnauthorizedHandler(() => {})
    setMaintenanceHandler(() => {})
  })

  it('GET sends credentials and returns parsed JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await apiClient.get<{ status: string }>('/health')

    expect(result).toEqual({ status: 'ok' })
    const [, init] = fetchMock.mock.calls[0]
    expect(init.credentials).toBe('include')
    // No body, no Content-Type — keeps a cross-origin GET a "simple" request
    // (no CORS preflight).
    expect(init.headers).not.toHaveProperty('Content-Type')
  })

  it('POST serializes the body as JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ detail: 'sent' }, 202))
    vi.stubGlobal('fetch', fetchMock)

    await apiClient.post('/auth/otp/request', { email: 'learner@example.com' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/api/v1/auth/otp/request')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ email: 'learner@example.com' }))
    expect(init.headers).toHaveProperty('Content-Type', 'application/json')
  })

  it('PATCH serializes the body as JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ exam_variant: 'motor' }))
    vi.stubGlobal('fetch', fetchMock)

    await apiClient.patch('/auth/me', { exam_variant: 'motor' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/api/v1/auth/me')
    expect(init.method).toBe('PATCH')
    expect(init.body).toBe(JSON.stringify({ exam_variant: 'motor' }))
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
      expect((err as ApiError).name).toBe('ApiError')
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

  it('calls the registered maintenance handler with true on the maintenance header', async () => {
    const handler = vi.fn()
    setMaintenanceHandler(handler)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: 'SKS Lotse befindet sich aktuell im Wartungsmodus.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json', 'X-Maintenance-Mode': '1' },
        }),
      ),
    )

    await apiClient.get('/questions').catch(() => {})

    expect(handler).toHaveBeenCalledWith(true)
  })

  it('calls the registered maintenance handler with false on a normal response', async () => {
    const handler = vi.fn()
    setMaintenanceHandler(handler)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' })))

    await apiClient.get('/health')

    expect(handler).toHaveBeenCalledWith(false)
  })

  it.each([
    ['post', 'POST'],
    ['put', 'PUT'],
    ['patch', 'PATCH'],
  ] as const)('%s without a body sends none, and no Content-Type', async (verb, method) => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    await apiClient[verb]('/x')

    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe(method)
    expect(init.body).toBeUndefined()
    expect(init.headers).not.toHaveProperty('Content-Type')
  })

  it('PUT serializes the body as JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    await apiClient.put('/focus/1', { on: true })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.body).toBe(JSON.stringify({ on: true }))
    expect(init.headers).toHaveProperty('Content-Type', 'application/json')
  })

  it('DELETE uses the DELETE method', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await apiClient.delete('/auth/me')

    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE')
  })
})
