// Form styling after the template's contact form: outlined fields. `dark` is for forms sitting on a
// primary band, `light` for forms on the page background. Buttons: buttonStyles.ts; error and
// success messages: Messages.tsx.
export type FormTone = 'light' | 'dark'

const TONES = {
  light: {
    label: 'text-ink-soft',
    input: 'border-primary bg-surface text-ink',
    note: 'text-ink-soft',
  },
  dark: {
    label: 'text-surface',
    input: 'border-surface bg-transparent text-surface [&>option]:text-ink',
    note: 'text-surface-alt',
  },
}

export function formStyles(tone: FormTone) {
  const t = TONES[tone]
  return {
    label: `flex flex-col gap-1 text-sm ${t.label}`,
    // 16 px at least: iOS Safari zooms into a field with smaller text on focus and stays zoomed.
    input: `rounded-tile border-2 px-3 py-2 text-base ${t.input}`,
    note: t.note,
  }
}
