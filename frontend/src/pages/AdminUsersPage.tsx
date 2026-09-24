import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { apiClient } from '../api/client'
import type { AdminUserListItem, AdminUserListPage } from '../api/types'
import { useApiQuery } from '../hooks/useApiQuery'
import { formatDate, getFullName } from '../format'

const PAGE_SIZE = 50

const BUTTON =
  'border border-ink px-4 py-2 font-mono text-sm tracking-wide text-ink uppercase hover:bg-surface-alt disabled:opacity-60'

const ROW_BUTTON =
  'shrink-0 border border-ink px-2 py-1 font-mono text-xs tracking-wide text-ink uppercase hover:bg-surface-alt disabled:opacity-60'

function fetchPage(q: string, offset: number) {
  const params = new URLSearchParams({ q, offset: String(offset), limit: String(PAGE_SIZE) })
  return apiClient.get<AdminUserListPage>(`/admin/users?${params}`)
}

// All accounts, newest first, searchable by email and name (/admin/users).
export function AdminUsersPage() {
  // Set by AdminUserPage after deleting an account.
  const deleted = (useLocation().state as { deleted?: string } | null)?.deleted

  const [input, setInput] = useState('')
  const [q, setQ] = useState('')
  const query = useApiQuery(`admin-users?q=${q}`, () => fetchPage(q, 0))
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [moreFailed, setMoreFailed] = useState(false)
  const [blockingId, setBlockingId] = useState<number | null>(null)
  const [blockError, setBlockError] = useState<string | null>(null)

  // Toggled inline from the list, unlike the detail page's confirmed delete — reversible, so no
  // confirmation dance (ADR-0045).
  async function handleBlockToggle(user: AdminUserListItem) {
    setBlockError(null)
    setBlockingId(user.id)
    try {
      const updated = user.is_blocked
        ? await apiClient.delete<AdminUserListItem>(`/admin/users/${user.id}/block`)
        : await apiClient.post<AdminUserListItem>(`/admin/users/${user.id}/block`)
      query.setData((current) => ({
        ...current,
        items: current.items.map((item) => (item.id === user.id ? updated : item)),
      }))
    } catch {
      setBlockError('Die Sperre konnte nicht geändert werden.')
    } finally {
      setBlockingId(null)
    }
  }

  function handleSearch(event: FormEvent) {
    event.preventDefault()
    setMoreFailed(false)
    setQ(input.trim())
  }

  async function handleLoadMore() {
    if (!query.data) return
    setMoreFailed(false)
    setIsLoadingMore(true)
    try {
      const next = await fetchPage(q, query.data.items.length)
      query.setData((current) => ({ items: [...current.items, ...next.items], total: next.total }))
    } catch {
      setMoreFailed(true)
    } finally {
      setIsLoadingMore(false)
    }
  }

  const page = query.data

  return (
    <div className="flex flex-col gap-6">
      {deleted ? <p className="text-sm text-ink">Account {deleted} wurde gelöscht.</p> : null}
      <form role="search" className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={handleSearch}>
        <label className="flex flex-1 flex-col gap-1 text-sm text-ink-soft" htmlFor="user-search">
          E-Mail oder Name
          <input
            id="user-search"
            type="search"
            maxLength={254}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="border border-border bg-surface px-3 py-2 text-ink"
          />
        </label>
        <button
          type="submit"
          className="border border-ink bg-ink px-4 py-2 font-mono text-sm tracking-wide text-surface uppercase"
        >
          Suchen
        </button>
      </form>

      {query.isLoading ? <p className="text-sm text-ink-soft">Lädt …</p> : null}
      {query.failed ? <p className="text-sm text-danger">Die Benutzerliste konnte nicht geladen werden.</p> : null}
      {page ? (
        <>
          <p className="text-sm text-ink-soft">
            {page.total === 1 ? '1 Benutzer' : `${page.total} Benutzer`}
            {q ? ` für „${q}“` : ''}
          </p>
          {blockError ? <p className="text-sm text-danger">{blockError}</p> : null}
          {page.items.length > 0 ? (
            <ul className="flex flex-col divide-y divide-border border-y border-border">
              {page.items.map((user) => (
                <li key={user.id} className="flex items-center gap-2 px-1 py-1">
                  <Link
                    to={`/admin/users/${user.id}`}
                    className="flex min-w-0 flex-1 flex-col gap-1 px-1 py-2 hover:bg-surface-alt sm:flex-row sm:items-baseline sm:gap-4"
                  >
                    <span className="min-w-0 flex-1 font-mono text-sm break-all text-ink">{user.email}</span>
                    <span className="text-sm text-ink-soft">{getFullName(user) || '—'}</span>
                    <span className="flex gap-2 text-xs text-ink-soft">
                      {user.token_balance > 0 ? (
                        <span className="border border-border px-1">{user.token_balance} Token(s)</span>
                      ) : null}
                      {user.ads_removed ? <span className="border border-border px-1">Werbefrei</span> : null}
                      {user.is_blocked ? <span className="border border-danger px-1 text-danger">Gesperrt</span> : null}
                      <span>seit {formatDate(user.created_at)}</span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleBlockToggle(user)}
                    disabled={blockingId === user.id}
                    className={ROW_BUTTON}
                  >
                    {user.is_blocked ? 'Entsperren' : 'Sperren'}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {moreFailed ? <p className="text-sm text-danger">Weitere Benutzer konnten nicht geladen werden.</p> : null}
          {page.items.length < page.total ? (
            <button type="button" onClick={handleLoadMore} disabled={isLoadingMore} className={BUTTON}>
              Mehr laden
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
