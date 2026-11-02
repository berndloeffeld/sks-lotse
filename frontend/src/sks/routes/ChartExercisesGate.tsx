import { Navigate, Outlet } from 'react-router-dom'

import { chartExercisesForGuests } from '../chartCatalog'
import { useAuthStore } from '../store/authStore'

// The CHART_EXERCISES feature flag (ADR-0052): learners it doesn't cover never see the Kartenaufgaben.
// Guests pass while the build's flag is "on" (ADR-0056): App.tsx then mounts /charts and
// /charts/:number outside ProtectedRoute, and a prerendered page shows the guest's version until
// the session is known. Everywhere else the gate sits inside ProtectedRoute, so the user is loaded.
export function ChartExercisesGate() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const enabled = useAuthStore((state) => state.user?.can_use_chart_exercises ?? false)
  if (!isAuthenticated && chartExercisesForGuests()) return <Outlet />
  return enabled ? <Outlet /> : <Navigate to="/learn" replace />
}
