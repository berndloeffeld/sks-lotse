import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ApiError, apiClient } from '../api/client'
import type { AdminUser, AdminUserExport, ExamVariant } from '../api/types'
import { useApiQuery } from '../hooks/useApiQuery'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { GENDER_LABELS, VARIANT_LABELS } from '../labels'
import { useAuthStore } from '../store/authStore'
import { formatDate, formatDateTime, getFullName } from '../format'

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const BACK_LINK = 'font-mono text-xs tracking-wide text-ink-soft uppercase hover:text-ink'

// One account in the admin area (/admin/users/:id): view, export or delete it
// (Art. 15/17/20 DSGVO), remove ads, credit AI-check tokens (ADR-0043).
export function AdminUserPage() {
  const { id } = useParams()
  // An unknown id is a normal answer here (null), not a failed load.
  const query = useApiQuery(`admin-user-${id}`, () =>
    apiClient.get<AdminUser>(`/admin/users/${id}`).catch((err: unknown) => {
      if (err instanceof ApiError && err.status === 404) return null
      throw err
    }),
  )

  return (
    <div className="flex flex-col gap-6">
      <Link to="/admin/users" className={BACK_LINK}>
        ← Alle Benutzer
      </Link>
      {query.isLoading ? <p className="text-sm text-ink-soft">Lädt …</p> : null}
      {query.failed ? <p className="text-sm text-danger">Der Benutzer konnte nicht geladen werden.</p> : null}
      {query.data === null ? <p className="text-sm text-danger">Benutzer nicht gefunden.</p> : null}
      {query.data ? <AdminUserDetail user={query.data} onChange={query.setData} /> : null}
    </div>
  )
}

function AdminUserDetail({ user, onChange }: { user: AdminUser; onChange: (user: AdminUser) => void }) {
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.user)
  const setCurrentUser = useAuthStore((s) => s.setUser)

  // An admin editing their own account (self-testing ads/tokens) otherwise sees no effect
  // outside /admin until the next full page load: the logged-in session's own User is a
  // separate copy in authStore, not touched by this page's AdminUser state.
  function syncIfSelf(updated: AdminUser) {
    if (currentUser && currentUser.id === updated.id) {
      setCurrentUser({ ...currentUser, ads_removed: updated.ads_removed, token_balance: updated.token_balance })
    }
  }

  const exportAction = useAsyncAction()
  const toggleAction = useAsyncAction()
  const blockAction = useAsyncAction()
  const grantAction = useAsyncAction()
  const deleteAction = useAsyncAction()
  // A toggle and a token grant both PATCH the account; neither starts while the other runs.
  const isUpdating = toggleAction.isPending || grantAction.isPending

  const [grantTokensInput, setGrantTokensInput] = useState('')
  const [grantAmountInput, setGrantAmountInput] = useState('')

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('')

  function handleExport() {
    return exportAction.run(async () => {
      const data = await apiClient.get<AdminUserExport>(`/admin/users/${user.id}/export`)
      downloadJson(data, `sks-lotse-export-${user.id}.json`)
    }, 'Der Export konnte nicht erstellt werden.')
  }

  function handleToggle(field: 'ads_removed', errorMessage: string) {
    return toggleAction.run(async () => {
      const updated = await apiClient.patch<AdminUser>(`/admin/users/${user.id}`, { [field]: !user[field] })
      onChange(updated)
      syncIfSelf(updated)
    }, errorMessage)
  }

  // Blocking ends the account's current session immediately (ADR-0045); unblocking just lets it
  // log back in, so it doesn't need the same confirmation as the irreversible delete below.
  function handleBlockToggle() {
    return blockAction.run(async () => {
      const updated = user.is_blocked
        ? await apiClient.delete<AdminUser>(`/admin/users/${user.id}/block`)
        : await apiClient.post<AdminUser>(`/admin/users/${user.id}/block`)
      onChange(updated)
    }, 'Die Sperre konnte nicht geändert werden.')
  }

  // Manual token top-up (ADR-0043) — an off-platform payment until a payment provider exists.
  // grantAmountInput is optional: it records what the account actually paid (in €), so the
  // resulting purchases row is kept (anonymized) rather than deleted on account deletion.
  async function handleGrantTokens(event: FormEvent) {
    event.preventDefault()
    grantAction.setError(null)
    const tokens = Number(grantTokensInput)
    if (grantTokensInput.trim() === '' || !Number.isInteger(tokens) || tokens < 1) {
      grantAction.setError('Bitte eine ganze Zahl ab 1 eingeben.')
      return
    }
    let amountEurCents: number | undefined
    if (grantAmountInput.trim() !== '') {
      const amount = Number(grantAmountInput)
      if (!Number.isFinite(amount) || amount < 0) {
        grantAction.setError('Bitte einen gültigen Betrag ab 0 eingeben.')
        return
      }
      amountEurCents = Math.round(amount * 100)
    }
    await grantAction.run(async () => {
      const updated = await apiClient.patch<AdminUser>(`/admin/users/${user.id}`, {
        grant_tokens: tokens,
        ...(amountEurCents === undefined ? {} : { grant_amount_eur_cents: amountEurCents }),
      })
      onChange(updated)
      syncIfSelf(updated)
      setGrantTokensInput('')
      setGrantAmountInput('')
    }, 'Die Tokens konnten nicht gutgeschrieben werden.')
  }

  function handleDelete(event: FormEvent) {
    event.preventDefault()
    return deleteAction.run(async () => {
      await apiClient.delete(`/admin/users/${user.id}`)
      navigate('/admin/users', { state: { deleted: user.email } })
    }, 'Der Account konnte nicht gelöscht werden.')
  }

  const canConfirmDelete = deleteConfirmEmail.trim().toLowerCase() === user.email.toLowerCase()

  return (
    <section className="flex flex-col gap-6 border border-border p-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-ink-soft">E-Mail</dt>
        <dd className="font-mono break-all text-ink">{user.email}</dd>
        <dt className="text-ink-soft">ID</dt>
        <dd className="font-mono text-ink">{user.id}</dd>
        <dt className="text-ink-soft">Name</dt>
        <dd className="text-ink">{getFullName(user) || '—'}</dd>
        <dt className="text-ink-soft">Geschlecht</dt>
        <dd className="text-ink">{user.gender ? (GENDER_LABELS[user.gender] ?? user.gender) : '—'}</dd>
        <dt className="text-ink-soft">Angemeldet seit</dt>
        <dd className="text-ink">{formatDate(user.created_at)}</dd>
        <dt className="text-ink-soft">Letzter Login</dt>
        <dd className="text-ink">{user.last_login_at ? formatDateTime(user.last_login_at) : '—'}</dd>
        <dt className="text-ink-soft">AGB akzeptiert</dt>
        <dd className="text-ink">
          {user.agb_accepted_version
            ? `Version ${user.agb_accepted_version}${
                user.agb_accepted_at ? ` (${formatDateTime(user.agb_accepted_at)})` : ''
              }`
            : 'Noch nicht'}
        </dd>
        <dt className="text-ink-soft">Prüfungsvariante</dt>
        <dd className="text-ink">
          {user.exam_variant ? (VARIANT_LABELS[user.exam_variant as ExamVariant] ?? user.exam_variant) : '—'}
        </dd>
        <dt className="text-ink-soft">Beantwortete Fragen</dt>
        <dd className="text-ink">{user.question_progress_count}</dd>
        <dt className="text-ink-soft">Tokens</dt>
        <dd className="text-ink">{user.token_balance}</dd>
        <dt className="text-ink-soft">Sanitizer-Flags</dt>
        <dd className="text-ink">
          {user.ai_flags_count}
          {user.ai_flags_last_at ? ` (zuletzt ${formatDateTime(user.ai_flags_last_at)})` : ''}
        </dd>
        <dt className="text-ink-soft">Werbung</dt>
        <dd className="text-ink">{user.ads_removed ? 'Entfernt' : 'Aktiv'}</dd>
        <dt className="text-ink-soft">Zugang</dt>
        <dd className="text-ink">{user.is_blocked ? 'Gesperrt' : 'Aktiv'}</dd>
      </dl>

      <div className="flex flex-col gap-2">
        {toggleAction.error ? <p className="text-sm text-danger">{toggleAction.error}</p> : null}
        <button
          type="button"
          onClick={() => handleToggle('ads_removed', 'Die Werbung konnte nicht geändert werden.')}
          disabled={isUpdating}
          className="border border-ink px-4 py-2 font-mono text-sm tracking-wide text-ink uppercase hover:bg-surface-alt disabled:opacity-60"
        >
          {user.ads_removed ? 'Werbung wieder aktivieren' : 'Werbung entfernen'}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {blockAction.error ? <p className="text-sm text-danger">{blockAction.error}</p> : null}
        <button
          type="button"
          onClick={handleBlockToggle}
          disabled={blockAction.isPending}
          className="border border-ink px-4 py-2 font-mono text-sm tracking-wide text-ink uppercase hover:bg-surface-alt disabled:opacity-60"
        >
          {user.is_blocked ? 'Sperre aufheben' : 'Nutzer sperren'}
        </button>
      </div>

      <form className="flex flex-col gap-2" onSubmit={handleGrantTokens}>
        <label className="flex flex-col gap-1 text-sm text-ink-soft" htmlFor="grant-tokens">
          Tokens gutschreiben (aktuell: {user.token_balance})
          <input
            id="grant-tokens"
            type="number"
            min={1}
            value={grantTokensInput}
            onChange={(event) => setGrantTokensInput(event.target.value)}
            className="border border-border bg-surface px-3 py-2 text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-soft" htmlFor="grant-amount">
          Erhaltener Betrag in € (optional, für die Kaufhistorie)
          <input
            id="grant-amount"
            type="number"
            min={0}
            step="0.01"
            value={grantAmountInput}
            onChange={(event) => setGrantAmountInput(event.target.value)}
            className="border border-border bg-surface px-3 py-2 text-ink"
          />
        </label>
        {grantAction.error ? <p className="text-sm text-danger">{grantAction.error}</p> : null}
        <button
          type="submit"
          disabled={isUpdating}
          className="border border-ink px-4 py-2 font-mono text-sm tracking-wide text-ink uppercase hover:bg-surface-alt disabled:opacity-60"
        >
          Tokens gutschreiben
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {exportAction.error ? <p className="text-sm text-danger">{exportAction.error}</p> : null}
        <button
          type="button"
          onClick={handleExport}
          disabled={exportAction.isPending}
          className="border border-ink px-4 py-2 font-mono text-sm tracking-wide text-ink uppercase hover:bg-surface-alt disabled:opacity-60"
        >
          Daten exportieren
        </button>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="border border-danger px-4 py-2 font-mono text-sm tracking-wide text-danger uppercase hover:bg-surface-alt"
          >
            Account löschen
          </button>
        ) : (
          <form className="flex flex-col gap-2" onSubmit={handleDelete}>
            <label className="flex flex-col gap-1 text-sm text-ink-soft" htmlFor="delete-confirm-email">
              Zur Bestätigung E-Mail-Adresse erneut eingeben: {user.email}
              <input
                id="delete-confirm-email"
                type="email"
                value={deleteConfirmEmail}
                onChange={(event) => setDeleteConfirmEmail(event.target.value)}
                className="border border-border bg-surface px-3 py-2 text-ink"
              />
            </label>
            {deleteAction.error ? <p className="text-sm text-danger">{deleteAction.error}</p> : null}
            <button
              type="submit"
              disabled={!canConfirmDelete || deleteAction.isPending}
              className="border border-danger bg-danger px-4 py-2 font-mono text-sm tracking-wide text-surface uppercase disabled:opacity-60"
            >
              Endgültig löschen
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
