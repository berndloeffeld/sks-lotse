import { useEffect, useState, type FormEvent } from 'react'

import { apiClient } from '../api/client'
import type { AdminSettings } from '../api/types'

// App-wide admin settings (/admin/settings); AdminLayout does the admin check.
export function AdminSettingsPage() {
  const [weeklyDefault, setWeeklyDefault] = useState('')
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    apiClient
      .get<AdminSettings>('/admin/settings')
      .then((settings) => {
        setWeeklyDefault(String(settings.ai_checks_weekly_default))
        setIsLoaded(true)
      })
      .catch(() => setError('Die Einstellungen konnten nicht geladen werden.'))
  }, [])

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    setSaved(false)
    const value = Number(weeklyDefault)
    if (weeklyDefault.trim() === '' || !Number.isInteger(value) || value < 0) {
      setError('Bitte eine ganze Zahl ab 0 eingeben.')
      return
    }
    setError(null)
    setIsSaving(true)
    try {
      const updated = await apiClient.put<AdminSettings>('/admin/settings', { ai_checks_weekly_default: value })
      setWeeklyDefault(String(updated.ai_checks_weekly_default))
      setSaved(true)
    } catch {
      setError('Die Einstellung konnte nicht gespeichert werden.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-soft">
        Gilt für alle Accounts ohne eigenes Limit. Die Woche beginnt montags um 0 Uhr (deutsche Zeit).
      </p>
      <form className="flex flex-col gap-4" onSubmit={handleSave}>
        <label className="flex flex-col gap-1 text-sm text-ink-soft" htmlFor="weekly-default">
          KI-Prüfungen pro Woche (Standard)
          <input
            id="weekly-default"
            type="number"
            min={0}
            value={weeklyDefault}
            disabled={!isLoaded}
            onChange={(event) => setWeeklyDefault(event.target.value)}
            className="border border-border bg-surface px-3 py-2 text-ink"
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {saved ? <p className="text-sm text-ink">Gespeichert.</p> : null}
        <button
          type="submit"
          disabled={!isLoaded || isSaving}
          className="border border-ink bg-ink px-4 py-2 font-mono text-sm tracking-wide text-surface uppercase disabled:opacity-60"
        >
          Speichern
        </button>
      </form>
    </div>
  )
}
