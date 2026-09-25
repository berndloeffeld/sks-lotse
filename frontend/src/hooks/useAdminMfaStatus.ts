import { useEffect } from 'react'

import { apiClient, setMfaRequiredHandler } from '../api/client'
import type { AdminMfaStatus } from '../api/types'
import { useApiQuery } from './useApiQuery'

function fetchStatus() {
  return apiClient.get<AdminMfaStatus>('/admin/mfa/status')
}

// Whether this admin session has passed its TOTP check (ADR-0047). Also reloads the status
// whenever an admin call answers "mfa_required" — the check ran out while the admin was working —
// so the admin area asks for a code again instead of showing a failed page.
export function useAdminMfaStatus() {
  const { data, failed, reload } = useApiQuery('admin-mfa-status', fetchStatus)

  useEffect(() => {
    setMfaRequiredHandler(() => void reload())
    return () => setMfaRequiredHandler(null)
  }, [reload])

  return { status: data, failed, reload }
}
