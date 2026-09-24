// Rounded share of `part` in `total`, as a whole-number percentage — 0 for
// an empty total rather than NaN.
export function percentOf(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

import type { User } from './api/types'

type Named = Pick<User, 'first_name' | 'last_name'>

// "Vorname Nachname", or '' when neither is set.
export function getFullName(person: Named): string {
  return `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim()
}

// The name where one is set, the email otherwise.
export function getDisplayName(user: Named & Pick<User, 'email'>): string {
  return getFullName(user) || user.email
}

// "19.09.2026" — the learner's local date.
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { dateStyle: 'medium' })
}

// "19.09.2026, 14:05" — the learner's local time.
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
}

// Remaining exam time as "89:05" — minutes only, the exam is 90 minutes long.
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

// Integer cents (as the API sends prices, ADR-0043) as "2,99 €".
export function formatEurCents(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}
