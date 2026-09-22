import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { ApiError, apiClient } from '../api/client'
import { getFullName, type AdminUserExport, type AdminUserSearchResult, type ExamVariant } from '../api/types'
import { PageLayout } from '../components/PageLayout'
import { GENDER_LABELS, VARIANT_LABELS } from '../labels'
import { useAuthStore } from '../store/authStore'

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

export function AdminPage() {
  const user = useAuthStore((state) => state.user)

  const [searchEmail, setSearchEmail] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [result, setResult] = useState<AdminUserSearchResult | null>(null)

  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const [isToggling, setIsToggling] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  const [limitInput, setLimitInput] = useState('')
  const [limitError, setLimitError] = useState<string | null>(null)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null)

  // Admin status comes from the already-loaded session (ProtectedRoute has
  // already waited for checkSession) — no separate loading state needed here,
  // same idiom as LoginPage's synchronous isAuthenticated redirect.
  if (!user?.is_admin) {
    return <Navigate to="/start" replace />
  }

  function resetResult() {
    setResult(null)
    setShowDeleteConfirm(false)
    setDeleteConfirmEmail('')
    setDeleteError(null)
    setExportError(null)
    setToggleError(null)
    setLimitError(null)
  }

  async function handleSearch(event: FormEvent) {
    event.preventDefault()
    setSearchError(null)
    setDeleteSuccess(null)
    setIsSearching(true)
    try {
      const found = await apiClient.post<AdminUserSearchResult>('/admin/users/search', { email: searchEmail })
      resetResult()
      setResult(found)
      setLimitInput(found.ai_checks_weekly_limit === null ? '' : String(found.ai_checks_weekly_limit))
    } catch (err) {
      setResult(null)
      setSearchError(
        err instanceof ApiError && err.status === 404
          ? 'Kein Nutzer mit dieser E-Mail-Adresse gefunden.'
          : 'Die Suche ist fehlgeschlagen. Bitte erneut versuchen.',
      )
    } finally {
      setIsSearching(false)
    }
  }

  async function handleExport() {
    if (!result) return
    setExportError(null)
    setIsExporting(true)
    try {
      const data = await apiClient.get<AdminUserExport>(`/admin/users/${result.id}/export`)
      downloadJson(data, `sks-lotse-export-${result.id}.json`)
    } catch {
      setExportError('Der Export konnte nicht erstellt werden.')
    } finally {
      setIsExporting(false)
    }
  }

  async function handleToggle(field: 'ai_grading_enabled' | 'ads_removed', errorMessage: string) {
    if (!result) return
    setToggleError(null)
    setIsToggling(true)
    try {
      const updated = await apiClient.patch<AdminUserSearchResult>(`/admin/users/${result.id}`, {
        [field]: !result[field],
      })
      setResult(updated)
    } catch {
      setToggleError(errorMessage)
    } finally {
      setIsToggling(false)
    }
  }

  // limit = null resets the account to the app-wide default.
  async function handleSaveLimit(limit: number | null) {
    if (!result) return
    setLimitError(null)
    setIsToggling(true)
    try {
      const updated = await apiClient.patch<AdminUserSearchResult>(`/admin/users/${result.id}`, {
        ai_checks_weekly_limit: limit,
      })
      setResult(updated)
      setLimitInput(updated.ai_checks_weekly_limit === null ? '' : String(updated.ai_checks_weekly_limit))
    } catch {
      setLimitError('Das Wochenlimit konnte nicht geändert werden.')
    } finally {
      setIsToggling(false)
    }
  }

  async function handleDelete(event: FormEvent) {
    event.preventDefault()
    if (!result) return
    setDeleteError(null)
    setIsDeleting(true)
    try {
      await apiClient.delete(`/admin/users/${result.id}`)
      const deletedEmail = result.email
      resetResult()
      setSearchEmail('')
      setDeleteSuccess(`Account ${deletedEmail} wurde gelöscht.`)
    } catch {
      setDeleteError('Der Account konnte nicht gelöscht werden.')
    } finally {
      setIsDeleting(false)
    }
  }

  const canConfirmDelete = result !== null && deleteConfirmEmail.trim().toLowerCase() === result.email.toLowerCase()

  return (
    <PageLayout
      title="Admin"
      backTo="/start"
      subtitle="Nutzerdaten einsehen, exportieren oder löschen (Art. 15/17/20 DSGVO) und die KI-Prüfung freischalten."
    >
      <form className="flex flex-col gap-4" onSubmit={handleSearch}>
        <label className="flex flex-col gap-1 text-sm text-ink-soft" htmlFor="search-email">
          E-Mail-Adresse
          <input
            id="search-email"
            type="email"
            required
            value={searchEmail}
            onChange={(event) => setSearchEmail(event.target.value)}
            className="border border-border bg-surface px-3 py-2 text-ink"
          />
        </label>
        {searchError ? <p className="text-sm text-danger">{searchError}</p> : null}
        {deleteSuccess ? <p className="text-sm text-ink">{deleteSuccess}</p> : null}
        <button
          type="submit"
          disabled={isSearching}
          className="border border-ink bg-ink px-4 py-2 font-mono text-sm tracking-wide text-surface uppercase disabled:opacity-60"
        >
          Suchen
        </button>
      </form>

      {result ? (
        <section className="flex flex-col gap-6 border border-border p-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-ink-soft">E-Mail</dt>
            <dd className="font-mono text-ink">{result.email}</dd>
            <dt className="text-ink-soft">ID</dt>
            <dd className="font-mono text-ink">{result.id}</dd>
            <dt className="text-ink-soft">Name</dt>
            <dd className="text-ink">{getFullName(result) || '—'}</dd>
            <dt className="text-ink-soft">Geschlecht</dt>
            <dd className="text-ink">{result.gender ? (GENDER_LABELS[result.gender] ?? result.gender) : '—'}</dd>
            <dt className="text-ink-soft">Angemeldet seit</dt>
            <dd className="text-ink">{new Date(result.created_at).toLocaleDateString('de-DE')}</dd>
            <dt className="text-ink-soft">Prüfungsvariante</dt>
            <dd className="text-ink">
              {result.exam_variant ? (VARIANT_LABELS[result.exam_variant as ExamVariant] ?? result.exam_variant) : '—'}
            </dd>
            <dt className="text-ink-soft">Beantwortete Fragen</dt>
            <dd className="text-ink">{result.question_progress_count}</dd>
            <dt className="text-ink-soft">KI-Prüfung</dt>
            <dd className="text-ink">{result.ai_grading_enabled ? 'Freigeschaltet' : 'Nicht freigeschaltet'}</dd>
            <dt className="text-ink-soft">KI-Prüfungen diese Woche</dt>
            <dd className="text-ink">
              {result.ai_checks_used} von {result.ai_checks_limit}
              {result.ai_checks_weekly_limit === null ? ' (Standard)' : ' (eigenes Limit)'}
            </dd>
            <dt className="text-ink-soft">Sanitizer-Flags</dt>
            <dd className="text-ink">
              {result.ai_flags_count}
              {result.ai_flags_last_at ? ` (zuletzt ${new Date(result.ai_flags_last_at).toLocaleString('de-DE')})` : ''}
            </dd>
            <dt className="text-ink-soft">Werbung</dt>
            <dd className="text-ink">{result.ads_removed ? 'Entfernt' : 'Aktiv'}</dd>
          </dl>

          <div className="flex flex-col gap-2">
            {toggleError ? <p className="text-sm text-danger">{toggleError}</p> : null}
            <button
              type="button"
              onClick={() => handleToggle('ai_grading_enabled', 'Die KI-Prüfung konnte nicht geändert werden.')}
              disabled={isToggling}
              className="border border-ink px-4 py-2 font-mono text-sm tracking-wide text-ink uppercase hover:bg-surface-alt disabled:opacity-60"
            >
              {result.ai_grading_enabled ? 'KI-Prüfung entziehen' : 'KI-Prüfung freischalten'}
            </button>
            <button
              type="button"
              onClick={() => handleToggle('ads_removed', 'Die Werbung konnte nicht geändert werden.')}
              disabled={isToggling}
              className="border border-ink px-4 py-2 font-mono text-sm tracking-wide text-ink uppercase hover:bg-surface-alt disabled:opacity-60"
            >
              {result.ads_removed ? 'Werbung wieder aktivieren' : 'Werbung entfernen'}
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
                disabled={isToggling || result.ai_checks_weekly_limit === null}
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
                  Zur Bestätigung E-Mail-Adresse erneut eingeben: {result.email}
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
      ) : null}

      <Link to="/admin/settings" className="text-sm text-ink underline">
        Standard-Wochenlimit für die KI-Prüfung ändern
      </Link>
    </PageLayout>
  )
}
