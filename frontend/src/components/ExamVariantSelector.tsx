export type ExamVariant = 'motor' | 'segeln_und_motor'

interface ExamVariantSelectorProps {
  value: string | null
  onChange: (variant: ExamVariant) => void
  disabled?: boolean
}

const OPTIONS: { value: ExamVariant; label: string; description: string }[] = [
  {
    value: 'segeln_und_motor',
    label: 'Motor und Segeln',
    description: 'Zusätzlich Rigg- und Segeltrimm-Fragen aus Seemannschaft I.',
  },
  {
    value: 'motor',
    label: 'Motor',
    description: 'Zusätzlich Motor- und Bootstyp-Fragen aus Seemannschaft II.',
  },
]

// Explains and sets User.exam_variant (PATCH /auth/me) — the "motor" vs.
// "segeln_und_motor" propulsion-type choice that scopes which questions and
// topics /questions and /topics/progress-summary return. No color-coding or
// icons, matching the plain radio-list treatment ADR-0014 uses elsewhere.
export function ExamVariantSelector({ value, onChange, disabled }: ExamVariantSelectorProps) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="font-serif text-lg text-ink">Prüfungsvariante</legend>
      <p className="text-sm text-ink-soft">
        Beide Varianten teilen sich Navigation, Schifffahrtsrecht, Wetterkunde und die allgemeinen Seemannschaft-Fragen.
      </p>
      <div className="flex flex-col gap-3">
        {OPTIONS.map((option) => {
          const inputId = `exam-variant-${option.value}`
          const descriptionId = `${inputId}-description`
          return (
            <div key={option.value} className="flex items-start gap-3 text-sm">
              <input
                type="radio"
                id={inputId}
                name="exam-variant"
                value={option.value}
                checked={value === option.value}
                disabled={disabled}
                onChange={() => onChange(option.value)}
                aria-describedby={descriptionId}
                className="mt-1"
              />
              <label htmlFor={inputId} className="flex flex-col">
                <span className="font-mono text-ink uppercase tracking-wide">{option.label}</span>
                <span id={descriptionId} className="text-ink-soft">
                  {option.description}
                </span>
              </label>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
