import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { apiClient } from '../api/client'
import type { AdminUserExport, AdminUserSearchResult } from '../api/types'
import { ContourBackground } from '../components/ContourBackground'
import { LegalFooter } from '../components/LegalFooter'
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
    } catch {
      setResult(null)
      setSearchError('Kein Nutzer mit dieser E-Mail-Adresse gefunden.')
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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-12">
      <header className="relative overflow-hidden py-4">
        <ContourBackground className="h-24" />
        <div className="relative">
          <Link to="/start" className="font-mono text-xs tracking-wide text-ink-soft uppercase hover:text-ink">
            ← Zurück
          </Link>
          <h1 className="mt-2 font-serif text-2xl text-ink">Admin</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Nutzerdaten einsehen, exportieren oder löschen (Art. 15/17/20 DSGVO).
          </p>
        </div>
      </header>

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
            <dd className="text-ink">{`${result.first_name ?? ''} ${result.last_name ?? ''}`.trim() || '—'}</dd>
            <dt className="text-ink-soft">Geschlecht</dt>
            <dd className="text-ink">{result.gender ?? '—'}</dd>
            <dt className="text-ink-soft">Angemeldet seit</dt>
            <dd className="text-ink">{new Date(result.created_at).toLocaleDateString('de-DE')}</dd>
            <dt className="text-ink-soft">Prüfungsvariante</dt>
            <dd className="text-ink">{result.exam_variant ?? '—'}</dd>
            <dt className="text-ink-soft">Beantwortete Fragen</dt>
            <dd className="text-ink">{result.question_progress_count}</dd>
          </dl>

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

      <LegalFooter />
    </main>
  )
}
