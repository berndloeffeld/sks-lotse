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

const PERCENT_FORMAT = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 0 })

// A whole-number percentage the German way, "54 %" (with a no-break space) — `ratio` is 0..1.
export function formatPercent(ratio: number): string {
  return PERCENT_FORMAT.format(ratio)
}

// A decimal with the German comma, "37,5" — at most `digits` places, none when whole.
export function formatDecimal(value: number, digits = 1): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: digits })
}

// "1 Token", "5 Tokens" — the singular where the count is exactly one.
export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

// `part` of `total` as "54 %" — "0 %" for an empty total.
export function formatPercentOf(part: number, total: number): string {
  return formatPercent(percentOf(part, total) / 100)
}
