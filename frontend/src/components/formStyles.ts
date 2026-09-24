// Form styling after the template's contact form: outlined fields, one
// accent button. `dark` is for forms sitting on a primary band, `light` for
// forms on the page background.
export type FormTone = 'light' | 'dark'

const TONES = {
  light: {
    label: 'text-ink-soft',
    input: 'border-primary bg-surface text-ink',
    note: 'text-ink-soft',
    link: 'text-primary',
  },
  dark: {
    label: 'text-surface',
    input: 'border-surface bg-transparent text-surface [&>option]:text-ink',
    note: 'text-surface-alt',
    link: 'text-surface',
  },
}

export function formStyles(tone: FormTone) {
  const t = TONES[tone]
  return {
    label: `flex flex-col gap-1 text-sm ${t.label}`,
    input: `rounded-tile border-2 px-3 py-2 ${t.input}`,
    note: t.note,
    link: `text-sm underline ${t.link}`,
    button:
      'rounded-tile bg-accent px-4 py-3 font-mono text-sm tracking-wide text-surface uppercase transition hover:bg-ink disabled:opacity-60',
    error: 'rounded-tile bg-danger px-3 py-2 text-sm text-surface',
  }
}
