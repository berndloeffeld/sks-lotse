import { percentOf } from '../format'
import { useExamVariantUpdate } from '../hooks/useExamVariantUpdate'
import { useAuthStore } from '../store/authStore'
import { Columns } from './Bands'
import { ExamVariantDropdown } from './ExamVariantDropdown'
import { ProgressPie, type ProgressSlice } from './ProgressPie'
import { ErrorMessage } from './Messages'
import { sectionHeading } from './headingStyles'

interface ProgressOverviewProps {
  totals: { learned: number; learning: number; total: number }
  categories: ProgressSlice[]
}

// The Lernstand at a glance, as three band columns: overall progress, the
// per-category pie, and the exam-variant picker. Shared by /learn and
// /profile; the caller owns the /progress/summary fetch (useProgressSummary).
export function ProgressOverview({ totals, categories }: ProgressOverviewProps) {
  const user = useAuthStore((state) => state.user)
  const { changeVariant, isSaving, error } = useExamVariantUpdate()
  const percent = percentOf(totals.learned, totals.total)
  const learningPercent = percentOf(totals.learning, totals.total)

  return (
    <Columns>
      <div className="flex flex-col gap-4">
        <h2 className={sectionHeading}>Gesamtfortschritt</h2>
        <p className="font-serif text-5xl text-ink">{percent}%</p>
        <div className="flex h-1.5 w-full bg-surface-alt">
          <div className="h-full bg-success" style={{ width: `${percent}%` }} />
          <div className="h-full bg-success opacity-40" style={{ width: `${learningPercent}%` }} />
        </div>
        <p className="font-mono text-xs text-ink-soft">
          {totals.learned} von {totals.total} Fragen gelernt
          {totals.learning > 0 ? ` · ${totals.learning} teilweise` : ''}
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <h2 className={sectionHeading}>Fachgebiete</h2>
        {categories.length > 0 ? <ProgressPie slices={categories} /> : null}
      </div>
      <div className="flex flex-col gap-4">
        <h2 className={sectionHeading}>Prüfungsvariante</h2>
        <p className="text-sm leading-relaxed text-ink-soft">Bestimmt, welche Seemannschaft-Fragen du übst.</p>
        <ExamVariantDropdown value={user?.exam_variant ?? null} onChange={changeVariant} disabled={isSaving} />
        <ErrorMessage>{error}</ErrorMessage>
      </div>
    </Columns>
  )
}
