import { useState, type FormEvent } from 'react'

import { apiClient } from '../api/client'
import type { AdminBlockedEmail } from '../api/types'
import { useApiQuery } from '../hooks/useApiQuery'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { ErrorMessage } from '../components/Messages'
import { buttonClass } from '../components/buttonStyles'

const INPUT = 'border border-ink-soft bg-surface px-3 py-2 text-base text-ink sm:text-sm'
const LABEL = 'flex flex-col gap-1 text-sm text-ink-soft'

function fetchBlocklist() {
  return apiClient.get<AdminBlockedEmail[]>('/admin/blocklist')
}

// Manually blocked addresses/domains for spam and abuse (/admin/blocklist, ADR-0045) — separate
// from the disposable-domain check and from ALLOWED_EMAILS/ADMIN_EMAILS, which are operator-set
// env vars, not editable here. Blocking a single account instead is done from its own page/the
// user list (AdminUserPage.tsx / AdminUsersPage.tsx).
export function AdminBlocklistPage() {
  const query = useApiQuery('admin-blocklist', fetchBlocklist)

  const [kind, setKind] = useState<'email' | 'domain'>('email')
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const { run, isPending: isSaving, error } = useAsyncAction()

  const [removingId, setRemovingId] = useState<number | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    if (!value.trim()) return
    await run(async () => {
      const entry = await apiClient.post<AdminBlockedEmail>('/admin/blocklist', {
        kind,
        value: value.trim(),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      })
      query.setData((current) => [entry, ...current.filter((e) => e.id !== entry.id)])
      setValue('')
      setReason('')
    }, 'Der Eintrag konnte nicht gespeichert werden.')
  }

  async function handleRemove(entry: AdminBlockedEmail) {
    setRemoveError(null)
    setRemovingId(entry.id)
    try {
      await apiClient.delete(`/admin/blocklist/${entry.id}`)
      query.setData((current) => current.filter((e) => e.id !== entry.id))
    } catch {
      setRemoveError('Der Eintrag konnte nicht entfernt werden.')
    } finally {
      setRemovingId(null)
    }
  }

  const entries = query.data ?? []

  return (
    <div className="flex flex-col gap-6">
      <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={handleAdd}>
        <label className={LABEL} htmlFor="blocklist-kind">
          Art
          <select
            id="blocklist-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as 'email' | 'domain')}
            className={INPUT}
          >
            <option value="email">E-Mail-Adresse</option>
            <option value="domain">Domain</option>
          </select>
        </label>
        <label className={`flex-1 ${LABEL}`} htmlFor="blocklist-value">
          {kind === 'email' ? 'E-Mail-Adresse' : 'Domain'}
          <input
            id="blocklist-value"
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className={INPUT}
          />
        </label>
        <label className={`flex-1 ${LABEL}`} htmlFor="blocklist-reason">
          Grund (optional)
          <input
            id="blocklist-reason"
            type="text"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={INPUT}
          />
        </label>
        <button type="submit" disabled={isSaving} className={buttonClass('primary', { tone: 'admin' })}>
          Sperren
        </button>
      </form>
      <ErrorMessage>{error}</ErrorMessage>

      {query.isLoading ? <p className="text-sm text-ink-soft">Lädt …</p> : null}
      <ErrorMessage onRetry={query.reload}>
        {query.failed ? 'Die Sperrliste konnte nicht geladen werden.' : null}
      </ErrorMessage>
      <ErrorMessage>{removeError}</ErrorMessage>

      {query.data ? (
        entries.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-4 px-1 py-3">
                <span className="w-20 shrink-0 font-mono text-xs tracking-wide text-ink-soft uppercase">
                  {entry.kind === 'email' ? 'E-Mail' : 'Domain'}
                </span>
                <span className="min-w-0 flex-1 font-mono text-sm break-all text-ink">{entry.value}</span>
                <span className="hidden text-sm text-ink-soft sm:block">{entry.reason ?? '—'}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(entry)}
                  disabled={removingId === entry.id}
                  className={`shrink-0 ${buttonClass('secondary', { tone: 'admin', size: 'compact' })}`}
                >
                  Entsperren
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">Keine gesperrten Adressen oder Domains.</p>
        )
      ) : null}
    </div>
  )
}
