import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProgressSummarySection } from './ProgressSummarySection'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const progressSummary = [
  {
    subject: 'navigation',
    topic_slug: 'ankern',
    topic_name: 'Ankern',
    display_order: 1,
    total_questions: 7,
    learned_questions: 2,
  },
]

describe('ProgressSummarySection', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the overall progress tile, with the per-topic details collapsed by default', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(progressSummary)))

    render(<ProgressSummarySection />)

    // Overall progress tile aggregates across every topic and is always visible.
    expect(await screen.findByText('Gesamtfortschritt')).toBeInTheDocument()
    expect(screen.getByText('29%')).toBeInTheDocument()

    expect(screen.queryByText('Ankern')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Details anzeigen' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('reveals the per-topic details once expanded', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(progressSummary)))

    render(<ProgressSummarySection />)
    await screen.findByText('Gesamtfortschritt')

    await user.click(screen.getByRole('button', { name: 'Details anzeigen' }))

    expect(screen.getByText('Ankern')).toBeInTheDocument()
    // Appears twice: once in the aggregate tile, once in Ankern's own row
    // (the only topic in this fixture, so both read the same numbers).
    expect(screen.getAllByText('2 von 7 Fragen gelernt')).toHaveLength(2)
    // Subject heading in the details, plus the pie legend entry.
    expect(screen.getAllByText('Navigation')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Lernen starten' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Details ausblenden' })).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByRole('button', { name: 'Details ausblenden' }))

    expect(screen.queryByText('Ankern')).not.toBeInTheDocument()
  })

  it('merges the Seemannschaft subjects into one pie slice', async () => {
    const topic = (subject: string, slug: string, total: number, learned: number) => ({
      subject,
      topic_slug: slug,
      topic_name: slug,
      display_order: 1,
      total_questions: total,
      learned_questions: learned,
    })
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse([
            topic('navigation', 'a', 10, 5),
            topic('seemannschaft_allgemein', 'b', 20, 4),
            topic('seemannschaft_segeln', 'c', 10, 1),
          ]),
        ),
    )

    render(<ProgressSummarySection />)

    expect(await screen.findByText('Seemannschaft')).toBeInTheDocument()
    expect(screen.getByText('5 / 30 · 17%')).toBeInTheDocument()
    expect(screen.getByText('5 / 10 · 50%')).toBeInTheDocument()
  })

  it('shows an empty state when no topics are scoped in yet', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([])))

    render(<ProgressSummarySection />)

    expect(await screen.findByText('Keine Themen gefunden.')).toBeInTheDocument()
  })

  it('shows an error message when the progress fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'nope' }, 500)))

    render(<ProgressSummarySection />)

    expect(await screen.findByText('Der Lernstand konnte nicht geladen werden.')).toBeInTheDocument()
    // A failed fetch isn't the same as "no topics" — don't claim both.
    expect(screen.queryByText('Keine Themen gefunden.')).not.toBeInTheDocument()
  })
})
