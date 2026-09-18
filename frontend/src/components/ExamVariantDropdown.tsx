export type ExamVariant = 'motor' | 'segeln_und_motor'

interface ExamVariantDropdownProps {
  value: string | null
  onChange: (variant: ExamVariant) => void
  disabled?: boolean
}

const VARIANT_LABELS: Record<ExamVariant, string> = {
  segeln_und_motor: 'Motor und Segeln',
  motor: 'Motor',
}

// Sets User.exam_variant (PATCH /auth/me) — kept as a small header-area
// dropdown rather than a full explainer section, since it's a one-off
// setting the learner picks once, not the point of the /learn page.
export function ExamVariantDropdown({ value, onChange, disabled }: ExamVariantDropdownProps) {
  return (
    <label className="flex items-center gap-2 font-mono text-xs tracking-wide text-ink-soft uppercase">
      Variante
      <select
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as ExamVariant)}
        className="border border-border bg-surface px-2 py-1 font-mono text-xs text-ink normal-case"
      >
        <option value="" disabled>
          Wählen…
        </option>
        {(Object.entries(VARIANT_LABELS) as [ExamVariant, string][]).map(([variant, label]) => (
          <option key={variant} value={variant}>
            {label}
          </option>
        ))}
      </select>
    </label>
  )
}
