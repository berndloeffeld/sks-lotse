import { useCallback, useEffect, useState } from 'react'

import { RECENT_MFA_REQUIRED, apiClient, setMfaRequiredHandler } from '../api/client'
import type { AdminMfaStatus } from '../api/types'
import { useApiQuery } from './useApiQuery'

function fetchStatus() {
  return apiClient.get<AdminMfaStatus>('/admin/mfa/status')
}

// Whether this admin session has passed its TOTP check (ADR-0047). Also reloads the status
// whenever an admin call answers "mfa_required" — the check ran out while the admin was working —
// so the admin area asks for a code again instead of showing a failed page. "recent_mfa_required"
// (an export or deletion, whose check must be minutes old) sets `recentCheckRequired` instead: the
// session is still verified, only that one action wants a fresh code.
export function useAdminMfaStatus() {
  const { data, failed, reload } = useApiQuery('admin-mfa-status', fetchStatus)
  const [recentCheckRequired, setRecentCheckRequired] = useState(false)

  useEffect(() => {
    setMfaRequiredHandler((requirement) => {
      if (requirement === RECENT_MFA_REQUIRED) setRecentCheckRequired(true)
      else void reload()
    })
    return () => setMfaRequiredHandler(null)
  }, [reload])

  const recentCheckDone = useCallback(() => setRecentCheckRequired(false), [])

  return { status: data, failed, reload, recentCheckRequired, recentCheckDone }
}
