import { percentOf } from '../format'
import { useExamVariantUpdate } from '../hooks/useExamVariantUpdate'
import { useAuthStore } from '../store/authStore'
import { Columns } from './Bands'
import { ExamVariantDropdown } from './ExamVariantDropdown'
import { ProgressPie, type ProgressSlice } from './ProgressPie'

interface ProgressOverviewProps {
  totals: { learned: number; total: number }
  categories: ProgressSlice[]
}

// The Lernstand at a glance, as three band columns: overall progress, the
// per-category pie, and the exam-variant picker. Shared by /learn and
// /profile; the caller owns the /progress/summary fetch (useProgressSummary).
export function ProgressOverview({ totals, categories }: ProgressOverviewProps) {
  const user = useAuthStore((state) => state.user)
  const { changeVariant, isSaving, error } = useExamVariantUpdate()
  const percent = percentOf(totals.learned, totals.total)

  return (
    <Columns>
      <div className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl text-primary">Gesamtfortschritt</h2>
        <p className="font-serif text-5xl text-ink">{percent}%</p>
        <div className="h-1.5 w-full bg-surface-alt">
          <div className="h-full bg-success" style={{ width: `${percent}%` }} />
        </div>
        <p className="font-mono text-xs text-ink-soft">
          {totals.learned} von {totals.total} Fragen gelernt
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl text-primary">Fachgebiete</h2>
        {categories.length > 0 ? <ProgressPie slices={categories} /> : null}
      </div>
      <div className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl text-primary">Prüfungsvariante</h2>
        <p className="text-sm leading-relaxed text-ink-soft">Bestimmt, welche Seemannschaft-Fragen du übst.</p>
        <ExamVariantDropdown value={user?.exam_variant ?? null} onChange={changeVariant} disabled={isSaving} />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
    </Columns>
  )
}
