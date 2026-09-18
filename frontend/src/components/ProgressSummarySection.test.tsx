import { render, screen } from '@testing-library/react'
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

  it('shows overall progress and the Lernstand grouped by subject', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(progressSummary)))

    render(<ProgressSummarySection />)

    expect(await screen.findByText('Ankern')).toBeInTheDocument()
    // Appears twice: once in the aggregate tile, once in Ankern's own row
    // (the only topic in this fixture, so both read the same numbers).
    expect(screen.getAllByText('2 von 7 Fragen gelernt')).toHaveLength(2)
    expect(screen.getByText('Navigation')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lernen starten' })).toBeDisabled()

    // Overall progress tile aggregates across every topic.
    expect(screen.getByText('Gesamtfortschritt')).toBeInTheDocument()
    expect(screen.getByText('29%')).toBeInTheDocument()
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
  })
})
