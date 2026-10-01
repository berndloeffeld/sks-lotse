import { Navigate, Outlet } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'

// The CHART_EXERCISES feature flag (ADR-0052): learners it doesn't cover never see the Kartenaufgaben.
// Sits inside ProtectedRoute, so the user is loaded here.
export function ChartExercisesGate() {
  const enabled = useAuthStore((state) => state.user?.can_use_chart_exercises ?? false)
  return enabled ? <Outlet /> : <Navigate to="/learn" replace />
}
