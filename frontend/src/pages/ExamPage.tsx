import { Navigate } from 'react-router-dom'

import { ExamOverview } from '../components/ExamOverview'
import { PageLayout } from '../components/PageLayout'
import { useAuthStore } from '../store/authStore'

// The Probeprüfung. With the Kartenaufgaben it is a tab of /learn (Fragen = Lernen + Probeprüfung,
// navigation.ts), so /exam leads there; without them it stays a page of its own.
export function ExamPage() {
  const chartExercises = useAuthStore((state) => state.user?.can_use_chart_exercises ?? false)
  if (chartExercises) return <Navigate to="/learn?modus=exam" replace />

  return (
    <PageLayout title="Probeprüfung" compact>
      <ExamOverview />
    </PageLayout>
  )
}
