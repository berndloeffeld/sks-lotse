// Form styling after the template's contact form: outlined fields. `dark` is for forms sitting on a
// primary band, `light` for forms on the page background. Buttons: buttonStyles.ts; error and
// success messages: Messages.tsx.
export type FormTone = 'light' | 'dark'

const TONES = {
  light: {
    label: 'text-ink-soft',
    border: 'border-primary',
    input: 'bg-surface text-ink',
    note: 'text-ink-soft',
  },
  dark: {
    label: 'text-surface',
    border: 'border-surface',
    input: 'bg-transparent text-surface [&>option]:text-ink',
    note: 'text-surface-alt',
  },
}

export function formStyles(tone: FormTone) {
  const t = TONES[tone]
  return {
    label: `flex flex-col gap-1 text-sm ${t.label}`,
    // 16 px at least: iOS Safari zooms into a field with smaller text on focus and stays zoomed.
    input: `rounded-tile border-2 px-3 py-2 text-base ${t.border} ${t.input}`,
    // The field confirming something irreversible (the account deletion). Its own key, not
    // `input` plus `border-danger`: two border colours in one class list leave the winner to the
    // order of the generated CSS, which put the regular border on top.
    dangerInput: `rounded-tile border-2 border-danger px-3 py-2 text-base ${t.input}`,
    note: t.note,
  }
}
