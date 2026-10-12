import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { AdminDashboard, DailyKpis } from '../api/types'
import { jsonResponse } from '../test/fixtures'
import { AdminDashboardPage } from './AdminDashboardPage'

function day(iso: string, overrides: Partial<DailyKpis> = {}): DailyKpis {
  return {
    day: iso,
    new_users: 0,
    active_users: 0,
    ratings: 0,
    lotse_checks_catalog: 0,
    lotse_checks_chart: 0,
    tokens_spent: 0,
    purchases: 0,
    revenue_cents: 0,
    ...overrides,
  }
}

function dashboard(days: number, daily: DailyKpis[]): AdminDashboard {
  return {
    generated_at: '2026-10-12T07:00:00Z',
    days,
    growth: {
      users_total: 128,
      new_24h: 5,
      new_previous_24h: 3,
      new_7d: 21,
      variant_motor: 40,
      variant_segeln_und_motor: 80,
      variant_unset: 8,
      activation_rate_7d: 0.5,
    },
    engagement: {
      dau: 12,
      dau_previous: 10,
      wau: 40,
      mau: 90,
      stickiness: null,
      retention_cohort_size: 16,
      retention_rate: 0.25,
      ratings_24h: 300,
      ratings_per_active_user_24h: 25,
    },
    monetization: {
      lotse_checks_catalog_24h: 7,
      lotse_checks_chart_24h: 2,
      tokens_spent_24h: 11,
      tokens_spent_7d: 60,
      purchases_24h: 1,
      purchases_7d: 4,
      revenue_cents_24h: 499,
      revenue_cents_7d: 2096,
    },
    daily,
  }
}

const WEEK = [
  day('2026-10-06'),
  day('2026-10-07', { new_users: 4, lotse_checks_catalog: 2, lotse_checks_chart: 1 }),
  day('2026-10-08'),
  day('2026-10-09'),
  day('2026-10-10', { new_users: 9, revenue_cents: 1597, purchases: 3 }),
  day('2026-10-11'),
  day('2026-10-12', { new_users: 2, lotse_checks_catalog: 5 }),
]

function stubDashboard() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const days = Number(new URL(String(input), 'http://x').searchParams.get('days'))
    return jsonResponse(
      dashboard(days, days === 7 ? WEEK : Array.from({ length: days }, (_, i) => day(`2026-07-${i}`))),
    )
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('AdminDashboardPage', () => {
  it('shows the figures of the KPI mail and a chart per day for 30 days by default', async () => {
    const fetchMock = stubDashboard()
    render(<AdminDashboardPage />)

    expect(await screen.findByText('5 / 3 / 21')).toBeInTheDocument()
    expect(String(fetchMock.mock.calls[0][0])).toContain('/admin/dashboard?days=30')
    expect(screen.getByRole('button', { name: '30 Tage' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('128')).toBeInTheDocument()
    expect(screen.getByText('12 (10) / 40 / 90')).toBeInTheDocument()
    expect(screen.getByText('–')).toBeInTheDocument() // stickiness without monthly activity
    expect(screen.getByText(/25\s%\svon 16/)).toBeInTheDocument()
    expect(screen.getByText(/4,99\s€ \/ 20,96\s€/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Neuanmeldungen je Tag: keine Werte im Zeitraum' })).toBeInTheDocument()
    expect(screen.queryByText(/ältere Tage zeigen 0/)).not.toBeInTheDocument()
  })

  it('switches the range and sums up each chart', async () => {
    const user = userEvent.setup()
    stubDashboard()
    render(<AdminDashboardPage />)
    await screen.findByText('128')

    await user.click(screen.getByRole('button', { name: '7 Tage' }))

    expect(
      await screen.findByRole('img', { name: 'Neuanmeldungen je Tag: zusammen 15, höchster Tag 10.10. mit 9' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '7 Tage' })).toHaveAttribute('aria-pressed', 'true')
    const checks = screen.getByRole('img', { name: /^Lotsen-Checks je Tag/ })
    expect(checks).toHaveAccessibleName('Lotsen-Checks je Tag: zusammen 8, höchster Tag 12.10. mit 5')
    expect(within(checks).getByText('07.10.: Katalog 2, Kartenaufgabe 1')).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /^Umsatz je Tag \(brutto, Stripe\): zusammen 15,97\s€/ }),
    ).toBeInTheDocument()
  })

  it('says that the check log only reaches back 30 days on the 90-day view', async () => {
    const user = userEvent.setup()
    stubDashboard()
    render(<AdminDashboardPage />)
    await screen.findByText('128')

    await user.click(screen.getByRole('button', { name: '90 Tage' }))

    expect(await screen.findByText(/30 Tage aufbewahrt; ältere Tage zeigen 0/)).toBeInTheDocument()
  })

  it('offers a retry when loading fails', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ detail: 'boom' }, 500)),
    )
    render(<AdminDashboardPage />)

    expect(await screen.findByText('Die Übersicht konnte nicht geladen werden.')).toBeInTheDocument()
    stubDashboard()
    await user.click(screen.getByRole('button', { name: /erneut/i }))
    expect(await screen.findByText('128')).toBeInTheDocument()
  })
})
