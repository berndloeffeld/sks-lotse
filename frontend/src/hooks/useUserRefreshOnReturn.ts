import { useEffect } from 'react'

import { useAuthStore } from '../store/authStore'

// Back in this tab after it was hidden: re-read the account (refreshUser), so a change made in
// another tab or on another device meanwhile shows here too. Without it the exam-variant dropdown
// kept the old value while the server already filtered the questions by the new one.
export function useUserRefreshOnReturn() {
  const refreshUser = useAuthStore((state) => state.refreshUser)
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void refreshUser()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [refreshUser])
}
