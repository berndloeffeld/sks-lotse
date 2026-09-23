import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ApiError, apiClient } from '../api/client'
import { getFullName, type AdminUser, type AdminUserExport, type ExamVariant } from '../api/types'
import { useApiQuery } from '../hooks/useApiQuery'
import { GENDER_LABELS, VARIANT_LABELS } from '../labels'

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
// (Art. 15/17/20 DSGVO), unlock the AI check, remove ads, set its weekly limit.
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

  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const [isToggling, setIsToggling] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  const [limitInput, setLimitInput] = useState(
    user.ai_checks_weekly_limit === null ? '' : String(user.ai_checks_weekly_limit),
  )
  const [limitError, setLimitError] = useState<string | null>(null)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleExport() {
    setExportError(null)
    setIsExporting(true)
    try {
      const data = await apiClient.get<AdminUserExport>(`/admin/users/${user.id}/export`)
      downloadJson(data, `sks-lotse-export-${user.id}.json`)
    } catch {
      setExportError('Der Export konnte nicht erstellt werden.')
    } finally {
      setIsExporting(false)
    }
  }

  async function handleToggle(field: 'ai_grading_enabled' | 'ads_removed', errorMessage: string) {
    setToggleError(null)
    setIsToggling(true)
    try {
      onChange(await apiClient.patch<AdminUser>(`/admin/users/${user.id}`, { [field]: !user[field] }))
    } catch {
      setToggleError(errorMessage)
    } finally {
      setIsToggling(false)
    }
  }

  // limit = null resets the account to the app-wide default.
  async function handleSaveLimit(limit: number | null) {
    setLimitError(null)
    setIsToggling(true)
    try {
      const updated = await apiClient.patch<AdminUser>(`/admin/users/${user.id}`, {
        ai_checks_weekly_limit: limit,
      })
      onChange(updated)
      setLimitInput(updated.ai_checks_weekly_limit === null ? '' : String(updated.ai_checks_weekly_limit))
    } catch {
      setLimitError('Das Wochenlimit konnte nicht geändert werden.')
    } finally {
      setIsToggling(false)
    }
  }

  async function handleDelete(event: FormEvent) {
    event.preventDefault()
    setDeleteError(null)
    setIsDeleting(true)
    try {
      await apiClient.delete(`/admin/users/${user.id}`)
      navigate('/admin/users', { state: { deleted: user.email } })
    } catch {
      setDeleteError('Der Account konnte nicht gelöscht werden.')
      setIsDeleting(false)
    }
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
        <dd className="text-ink">{new Date(user.created_at).toLocaleDateString('de-DE')}</dd>
        <dt className="text-ink-soft">Letzter Login</dt>
        <dd className="text-ink">{user.last_login_at ? new Date(user.last_login_at).toLocaleString('de-DE') : '—'}</dd>
        <dt className="text-ink-soft">AGB akzeptiert</dt>
        <dd className="text-ink">
          {user.agb_accepted_version
            ? `Version ${user.agb_accepted_version}${
                user.agb_accepted_at ? ` (${new Date(user.agb_accepted_at).toLocaleString('de-DE')})` : ''
              }`
            : 'Noch nicht'}
        </dd>
        <dt className="text-ink-soft">Prüfungsvariante</dt>
        <dd className="text-ink">
          {user.exam_variant ? (VARIANT_LABELS[user.exam_variant as ExamVariant] ?? user.exam_variant) : '—'}
        </dd>
        <dt className="text-ink-soft">Beantwortete Fragen</dt>
        <dd className="text-ink">{user.question_progress_count}</dd>
        <dt className="text-ink-soft">KI-Prüfung</dt>
        <dd className="text-ink">{user.ai_grading_enabled ? 'Freigeschaltet' : 'Nicht freigeschaltet'}</dd>
        <dt className="text-ink-soft">KI-Prüfungen diese Woche</dt>
        <dd className="text-ink">
          {user.ai_checks_used} von {user.ai_checks_limit}
          {user.ai_checks_weekly_limit === null ? ' (Standard)' : ' (eigenes Limit)'}
        </dd>
        <dt className="text-ink-soft">Sanitizer-Flags</dt>
        <dd className="text-ink">
          {user.ai_flags_count}
          {user.ai_flags_last_at ? ` (zuletzt ${new Date(user.ai_flags_last_at).toLocaleString('de-DE')})` : ''}
        </dd>
        <dt className="text-ink-soft">Werbung</dt>
        <dd className="text-ink">{user.ads_removed ? 'Entfernt' : 'Aktiv'}</dd>
      </dl>

      <div className="flex flex-col gap-2">
        {toggleError ? <p className="text-sm text-danger">{toggleError}</p> : null}
        <button
          type="button"
          onClick={() => handleToggle('ai_grading_enabled', 'Die KI-Prüfung konnte nicht geändert werden.')}
          disabled={isToggling}
          className="border border-ink px-4 py-2 font-mono text-sm tracking-wide text-ink uppercase hover:bg-surface-alt disabled:opacity-60"
        >
          {user.ai_grading_enabled ? 'KI-Prüfung entziehen' : 'KI-Prüfung freischalten'}
        </button>
        <button
          type="button"
          onClick={() => handleToggle('ads_removed', 'Die Werbung konnte nicht geändert werden.')}
          disabled={isToggling}
          className="border border-ink px-4 py-2 font-mono text-sm tracking-wide text-ink uppercase hover:bg-surface-alt disabled:opacity-60"
        >
          {user.ads_removed ? 'Werbung wieder aktivieren' : 'Werbung entfernen'}
        </button>
      </div>

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const limit = Number(limitInput)
          if (limitInput.trim() === '' || !Number.isInteger(limit) || limit < 0) {
            setLimitError('Bitte eine ganze Zahl ab 0 eingeben.')
            return
          }
          handleSaveLimit(limit)
        }}
      >
        <label className="flex flex-col gap-1 text-sm text-ink-soft" htmlFor="weekly-limit">
          KI-Prüfungen pro Woche (Montag bis Sonntag)
          <input
            id="weekly-limit"
            type="number"
            min={0}
            value={limitInput}
            placeholder="Standard"
            onChange={(event) => setLimitInput(event.target.value)}
            className="border border-border bg-surface px-3 py-2 text-ink"
          />
        </label>
        {limitError ? <p className="text-sm text-danger">{limitError}</p> : null}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isToggling}
            className="border border-ink px-4 py-2 font-mono text-sm tracking-wide text-ink uppercase hover:bg-surface-alt disabled:opacity-60"
          >
            Limit speichern
          </button>
          <button
            type="button"
            onClick={() => handleSaveLimit(null)}
            disabled={isToggling || user.ai_checks_weekly_limit === null}
            className="border border-ink px-4 py-2 font-mono text-sm tracking-wide text-ink uppercase hover:bg-surface-alt disabled:opacity-60"
          >
            Standard verwenden
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-2">
        {exportError ? <p className="text-sm text-danger">{exportError}</p> : null}
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
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
            {deleteError ? <p className="text-sm text-danger">{deleteError}</p> : null}
            <button
              type="submit"
              disabled={!canConfirmDelete || isDeleting}
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
