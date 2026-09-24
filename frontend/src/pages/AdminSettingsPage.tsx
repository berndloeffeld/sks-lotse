import { useState, type FormEvent } from 'react'

import { apiClient } from '../api/client'
import type { AdminSettings, TokenPackageSettings } from '../api/types'
import { useApiQuery } from '../hooks/useApiQuery'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { PACKAGE_LABELS, PACKAGE_PRODUCTS, type PackageProduct } from '../labels'

// Euro-and-cent input as a plain string, e.g. "2.99" — kept as text (not a number) so a half-typed
// value ("2.") doesn't get silently mangled while the operator is still typing.
interface PackageForm {
  tokens: string
  price: string
}

interface SettingsForm {
  priceAdsRemoved: string
  signupBonusTokens: string
  packages: Record<PackageProduct, PackageForm>
}

function toForm(settings: AdminSettings): SettingsForm {
  const packages = Object.fromEntries(
    PACKAGE_PRODUCTS.map((product) => [
      product,
      { tokens: String(settings[product].tokens), price: (settings[product].price_cents / 100).toFixed(2) },
    ]),
  ) as Record<PackageProduct, PackageForm>
  return {
    priceAdsRemoved: (settings.price_ads_removed_cents / 100).toFixed(2),
    signupBonusTokens: String(settings.signup_bonus_tokens),
    packages,
  }
}

// A non-negative integer typed as text, e.g. a token count.
function parseWholeNumber(value: string): number | null {
  const parsed = Number(value)
  return value.trim() !== '' && Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

// A non-negative euro-and-cent amount typed as text, converted to whole cents.
function parseEurCents(value: string): number | null {
  const parsed = Number(value)
  return value.trim() !== '' && Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null
}

function buildPayload(form: SettingsForm): AdminSettings | null {
  const priceAdsRemovedCents = parseEurCents(form.priceAdsRemoved)
  const signupBonusTokens = parseWholeNumber(form.signupBonusTokens)
  const packages: Partial<Record<PackageProduct, TokenPackageSettings>> = {}
  for (const product of PACKAGE_PRODUCTS) {
    const tokens = parseWholeNumber(form.packages[product].tokens)
    const priceCents = parseEurCents(form.packages[product].price)
    if (tokens === null || priceCents === null) return null
    packages[product] = { tokens, price_cents: priceCents }
  }
  if (priceAdsRemovedCents === null || signupBonusTokens === null) return null
  return {
    price_ads_removed_cents: priceAdsRemovedCents,
    signup_bonus_tokens: signupBonusTokens,
    ...(packages as Record<PackageProduct, TokenPackageSettings>),
  }
}

const INPUT = 'border border-border bg-surface px-3 py-2 text-ink'
const LABEL = 'flex flex-col gap-1 text-sm text-ink-soft'

// App-wide admin settings (/admin/settings): every token-package/Werbefrei price (ADR-0043).
// AdminLayout does the admin check. PUT replaces all of it at once, so the form always submits
// the full set, not just the field the operator touched.
export function AdminSettingsPage() {
  const query = useApiQuery('admin-settings', () => apiClient.get<AdminSettings>('/admin/settings'))
  if (query.failed) return <p className="text-sm text-danger">Die Einstellungen konnten nicht geladen werden.</p>
  if (!query.data) return <p className="text-sm text-ink-soft">Lädt …</p>
  return <SettingsEditor initial={query.data} />
}

function SettingsEditor({ initial }: { initial: AdminSettings }) {
  const [form, setForm] = useState(() => toForm(initial))
  const { run, isPending: isSaving, error, setError } = useAsyncAction()
  const [saved, setSaved] = useState(false)

  function updatePackage(product: PackageProduct, patch: Partial<PackageForm>) {
    setForm((current) => ({
      ...current,
      packages: { ...current.packages, [product]: { ...current.packages[product], ...patch } },
    }))
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    setSaved(false)
    const payload = buildPayload(form)
    if (!payload) {
      setError('Bitte bei jedem Feld eine gültige, nicht-negative Zahl eingeben.')
      return
    }
    await run(async () => {
      setForm(toForm(await apiClient.put<AdminSettings>('/admin/settings', payload)))
      setSaved(true)
    }, 'Die Einstellungen konnten nicht gespeichert werden.')
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSave}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-soft">Preise (ADR-0043) — noch kein Kauf-Flow, nur die Anzeige/Beträge.</p>
        <label className={LABEL} htmlFor="price-ads-removed">
          Werbefrei, einmalig (€)
          <input
            id="price-ads-removed"
            type="number"
            min={0}
            step="0.01"
            value={form.priceAdsRemoved}
            onChange={(event) => setForm({ ...form, priceAdsRemoved: event.target.value })}
            className={INPUT}
          />
        </label>
        <label className={LABEL} htmlFor="signup-bonus-tokens">
          Geschenkte Tokens bei Anmeldung
          <input
            id="signup-bonus-tokens"
            type="number"
            min={0}
            value={form.signupBonusTokens}
            onChange={(event) => setForm({ ...form, signupBonusTokens: event.target.value })}
            className={INPUT}
          />
        </label>
        {PACKAGE_PRODUCTS.map((product) => (
          <fieldset key={product} className="flex flex-col gap-2 border border-border p-3">
            <legend className="px-1 text-sm text-ink">{PACKAGE_LABELS[product]}</legend>
            <label className={LABEL} htmlFor={`${product}-tokens`}>
              Tokens
              <input
                id={`${product}-tokens`}
                type="number"
                min={0}
                value={form.packages[product].tokens}
                onChange={(event) => updatePackage(product, { tokens: event.target.value })}
                className={INPUT}
              />
            </label>
            <label className={LABEL} htmlFor={`${product}-price`}>
              Preis (€)
              <input
                id={`${product}-price`}
                type="number"
                min={0}
                step="0.01"
                value={form.packages[product].price}
                onChange={(event) => updatePackage(product, { price: event.target.value })}
                className={INPUT}
              />
            </label>
          </fieldset>
        ))}
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {saved ? <p className="text-sm text-ink">Gespeichert.</p> : null}
      <button
        type="submit"
        disabled={isSaving}
        className="border border-ink bg-ink px-4 py-2 font-mono text-sm tracking-wide text-surface uppercase disabled:opacity-60"
      >
        Speichern
      </button>
    </form>
  )
}
