import { useState, type ReactNode } from 'react'

import { apiClient } from '../../shared/api/client'
import type { AdminDashboard, DashboardDays } from '../api/types'
import { DailyBars } from '../components/DailyBars'
import { ErrorMessage } from '../../shared/components/Messages'
import { buttonClass } from '../../shared/components/buttonStyles'
import { formatDateTime, formatDecimal, formatEurCents, formatPercent } from '../../shared/format'
import { useApiQuery } from '../../shared/hooks/useApiQuery'

const RANGES: DashboardDays[] = [7, 30, 90]
// lotse_check_log keeps 30 days (ADR-0032 addendum 2026-10-05); older days read 0.
const CHECK_LOG_DAYS = 30

function percent(ratio: number | null): string {
  return ratio === null ? '–' : formatPercent(ratio)
}

function decimal(value: number | null): string {
  return value === null ? '–' : formatDecimal(value)
}

// The admin overview (/admin/overview): the daily KPI mail's growth, engagement and Lotsen-Check
// sections (ADR-0032), each with its figures as of now and a chart per day. Aggregates only.
export function AdminDashboardPage() {
  const [days, setDays] = useState<DashboardDays>(30)
  const query = useApiQuery(`admin-dashboard-${days}`, () =>
    apiClient.get<AdminDashboard>(`/admin/dashboard?days=${days}`),
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          {query.data ? `Stand ${formatDateTime(query.data.generated_at)} · ` : ''}nur Summen, keine Einzelkonten
        </p>
        <div role="group" aria-label="Zeitraum" className="flex gap-2">
          {RANGES.map((range) => (
            <button
              key={range}
              type="button"
              aria-pressed={range === days}
              onClick={() => setDays(range)}
              className={buttonClass(range === days ? 'primary' : 'secondary', { tone: 'admin', size: 'compact' })}
            >
              {range} Tage
            </button>
          ))}
        </div>
      </div>
      {query.failed ? (
        <ErrorMessage onRetry={query.reload}>Die Übersicht konnte nicht geladen werden.</ErrorMessage>
      ) : query.data ? (
        <Dashboard data={query.data} />
      ) : (
        <p className="text-sm text-ink-soft">Lädt …</p>
      )}
    </div>
  )
}

function Dashboard({ data }: { data: AdminDashboard }) {
  const { growth: g, engagement: e, monetization: m, daily } = data
  const days = daily.map((row) => row.day)

  return (
    <>
      <Section title="Wachstum und Aktivierung">
        <Tiles>
          <Tile label="Konten gesamt" value={String(g.users_total)} />
          <Tile label="Neu 24 h / Vortag / 7 Tage" value={`${g.new_24h} / ${g.new_previous_24h} / ${g.new_7d}`} />
          <Tile label="Aktivierung (Neukonten 7 Tage mit mind. 1 Bewertung)" value={percent(g.activation_rate_7d)} />
          <Tile
            label="Prüfungsvariante Motor / Segeln+Motor / offen"
            value={`${g.variant_motor} / ${g.variant_segeln_und_motor} / ${g.variant_unset}`}
          />
        </Tiles>
        <DailyBars
          title="Neuanmeldungen je Tag"
          days={days}
          series={[{ name: 'Neu', values: daily.map((row) => row.new_users), fill: 'fill-primary' }]}
        />
      </Section>

      <Section title="Engagement">
        <Tiles>
          <Tile label="Aktiv DAU (Vortag) / WAU / MAU" value={`${e.dau} (${e.dau_previous}) / ${e.wau} / ${e.mau}`} />
          <Tile label="Stickiness DAU/MAU" value={percent(e.stickiness)} />
          <Tile
            label="Retention (Konten von vor 7–14 Tagen, letzte 7 Tage aktiv)"
            value={`${percent(e.retention_rate)} von ${e.retention_cohort_size}`}
          />
          <Tile
            label="Bewertungen 24 h (je aktivem Nutzer)"
            value={`${e.ratings_24h} (${decimal(e.ratings_per_active_user_24h)})`}
          />
        </Tiles>
        <DailyBars
          title="Aktive Lernende je Tag"
          days={days}
          series={[{ name: 'Aktiv', values: daily.map((row) => row.active_users), fill: 'fill-primary' }]}
        />
        <DailyBars
          title="Bewertungen je Tag"
          days={days}
          series={[{ name: 'Bewertungen', values: daily.map((row) => row.ratings), fill: 'fill-primary' }]}
        />
      </Section>

      <Section title="Lotsen-Check und Umsatz">
        <Tiles>
          <Tile
            label="Lotsen-Checks 24 h Katalog / Kartenaufgabe / SBF-Navigationsaufgabe"
            value={`${m.lotse_checks_catalog_24h} / ${m.lotse_checks_chart_24h} / ${m.lotse_checks_sbf_navigation_24h}`}
          />
          <Tile label="Verbrauchte Tokens 24 h / 7 Tage" value={`${m.tokens_spent_24h} / ${m.tokens_spent_7d}`} />
          <Tile label="Käufe 24 h / 7 Tage" value={`${m.purchases_24h} / ${m.purchases_7d}`} />
          <Tile
            label="Umsatz 24 h / 7 Tage (brutto, Stripe)"
            value={`${formatEurCents(m.revenue_cents_24h)} / ${formatEurCents(m.revenue_cents_7d)}`}
          />
        </Tiles>
        <DailyBars
          title="Lotsen-Checks je Tag"
          days={days}
          series={[
            { name: 'Katalog', values: daily.map((row) => row.lotse_checks_catalog), fill: 'fill-primary' },
            { name: 'Kartenaufgabe', values: daily.map((row) => row.lotse_checks_chart), fill: 'fill-accent' },
            {
              name: 'SBF-Navigationsaufgabe',
              values: daily.map((row) => row.lotse_checks_sbf_navigation),
              fill: 'fill-success',
            },
          ]}
        />
        <DailyBars
          title="Verbrauchte Tokens je Tag"
          days={days}
          series={[{ name: 'Tokens', values: daily.map((row) => row.tokens_spent), fill: 'fill-primary' }]}
        />
        {data.days > CHECK_LOG_DAYS ? (
          <p className="text-xs text-ink-soft">
            Lotsen-Checks und Tokens werden {CHECK_LOG_DAYS} Tage aufbewahrt; ältere Tage zeigen 0.
          </p>
        ) : null}
        <DailyBars
          title="Umsatz je Tag (brutto, Stripe)"
          days={days}
          series={[{ name: 'Umsatz', values: daily.map((row) => row.revenue_cents), fill: 'fill-success' }]}
          format={formatEurCents}
        />
        <DailyBars
          title="Käufe je Tag"
          days={days}
          series={[{ name: 'Käufe', values: daily.map((row) => row.purchases), fill: 'fill-success' }]}
        />
      </Section>
      <p className="text-xs text-ink-soft">
        Tage in UTC; der letzte Balken ist der heutige Tag bis jetzt. Aktiv heißt: eine Frage bewertet, eine
        Kartenaufgabe beantwortet oder eine Prüfung begonnen.
      </p>
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-mono text-sm tracking-wide text-ink-soft uppercase">{title}</h2>
      {children}
    </section>
  )
}

function Tiles({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</dl>
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 bg-surface-alt p-3">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="text-lg text-ink">{value}</dd>
    </div>
  )
}
