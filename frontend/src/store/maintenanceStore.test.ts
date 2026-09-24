import { afterEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '../api/client'
import { useMaintenanceStore } from './maintenanceStore'
import { jsonResponse } from '../test/fixtures'

describe('maintenanceStore', () => {
  afterEach(() => {
    useMaintenanceStore.setState({ maintenanceMode: false })
  })

  it('starts with maintenance mode off', () => {
    expect(useMaintenanceStore.getState().maintenanceMode).toBe(false)
  })

  it('flips on when a response carries the maintenance header', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ detail: 'Wartung' }, 503, { 'X-Maintenance-Mode': '1' })),
    )

    await apiClient.get('/questions').catch(() => {})

    expect(useMaintenanceStore.getState().maintenanceMode).toBe(true)
  })

  it('flips back off on the next normal response', async () => {
    useMaintenanceStore.setState({ maintenanceMode: true })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' })))

    await apiClient.get('/health')

    expect(useMaintenanceStore.getState().maintenanceMode).toBe(false)
  })
})
