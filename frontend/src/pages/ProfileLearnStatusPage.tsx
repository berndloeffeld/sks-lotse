import { Link } from 'react-router-dom'

import { Band } from '../components/Bands'
import { ExamStatsPanel } from '../components/ExamStatsPanel'
import { ProgressOverview } from '../components/ProgressOverview'
import { useProgressSummary } from '../hooks/useProgressSummary'

// /profile's "Lernstand" tab (the default): the same Lernstand overview as
// /learn, minus the exam-variant picker (that lives on the Konto tab here),
// plus the exam statistics. A variant change there navigates away from this
// route, so no extra remount-on-variant-change handling is needed here.
export function ProfileLearnStatusPage() {
  return (
    <>
      <Band className="pt-10 pb-16">
        <ProfileProgress />
      </Band>

      <Band className="pt-0 pb-16">
        <ExamStatsPanel />
      </Band>
    </>
  )
}

// Lernstand overview for the profile — same two columns as /learn (without
// the variant picker), with a link there for the per-topic details.
function ProfileProgress() {
  const { isLoading, error, totals, categories } = useProgressSummary()

  return (
    <div className="flex flex-col gap-8">
      <ProgressOverview totals={totals} categories={categories} showVariant={false} />
      {isLoading ? <p className="text-sm text-ink-soft">Lernstand wird geladen…</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Link to="/learn" className="self-start font-mono text-xs tracking-wide text-primary uppercase hover:underline">
        Alle Themen ansehen →
      </Link>
    </div>
  )
}
