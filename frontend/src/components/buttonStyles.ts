// The button looks of the whole app, for <button>, <Link> and <a> alike — one role, one look:
// - primary: the one action a screen leads to (Weiter, Prüfung starten, Speichern);
// - secondary: an alternative beside it (Alle Fragen wiederholen, Zur Startseite);
// - tertiary: a quiet text button (Abbrechen, Erneut laden, Frage melden);
// - dangerOutline: opens a deletion's confirmation; danger: confirms it (Endgültig löschen).
// `tone` follows the ground: `light` on the page, `dark` on a primary band, `admin` for the plainer
// admin area. `compact` is the size for buttons inside list rows.
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'dangerOutline'
export type ButtonTone = 'light' | 'dark' | 'admin'
export type ButtonSize = 'regular' | 'compact'

const SOLID = 'inline-block text-center font-mono tracking-wide uppercase transition disabled:opacity-60'

const TILE = { regular: 'rounded-tile border-2 px-4 py-3 text-sm', compact: 'rounded-tile border px-3 py-1.5 text-xs' }

const SHAPE: Record<ButtonTone, Record<ButtonSize, string>> = {
  light: TILE,
  dark: TILE,
  admin: { regular: 'border px-4 py-2 text-sm', compact: 'border px-2 py-1 text-xs' },
}

const DANGER = 'border-danger bg-danger text-surface hover:opacity-90'
const DANGER_OUTLINE = 'border-danger text-danger hover:bg-surface-alt'

const COLORS: Record<ButtonTone, Record<Exclude<ButtonVariant, 'tertiary'>, string>> = {
  light: {
    primary: 'border-accent bg-accent text-surface hover:border-ink hover:bg-ink',
    secondary: 'border-primary text-primary hover:bg-primary hover:text-surface',
    danger: DANGER,
    dangerOutline: DANGER_OUTLINE,
  },
  dark: {
    primary: 'border-accent bg-accent text-surface hover:border-ink hover:bg-ink',
    secondary: 'border-surface text-surface hover:bg-surface hover:text-primary-dark',
    danger: DANGER,
    dangerOutline: 'border-surface text-surface hover:bg-surface hover:text-danger',
  },
  admin: {
    primary: 'border-ink bg-ink text-surface',
    secondary: 'border-ink text-ink hover:bg-surface-alt',
    danger: DANGER,
    dangerOutline: DANGER_OUTLINE,
  },
}

const TERTIARY: Record<ButtonTone, string> = {
  light: 'text-primary hover:no-underline',
  dark: 'text-surface hover:no-underline',
  admin: 'text-ink-soft hover:text-ink',
}

export function buttonClass(
  variant: ButtonVariant,
  { tone = 'light', size = 'regular' }: { tone?: ButtonTone; size?: ButtonSize } = {},
) {
  if (variant === 'tertiary') {
    const text = size === 'compact' ? 'text-xs' : 'text-sm'
    return `${text} underline disabled:opacity-60 ${TERTIARY[tone]}`
  }
  return `${SOLID} ${SHAPE[tone][size]} ${COLORS[tone][variant]}`
}
