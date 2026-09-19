import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import type { TopicProgress } from '../api/types'
import { FocusBand } from './FocusBand'

const topic: TopicProgress = {
  subject: 'navigation',
  topic_slug: 'ankern',
  topic_name: 'Ankern',
  display_order: 1,
  total_questions: 10,
  learned_questions: 4,
  learning_questions: 2,
  is_focus: true,
}

function renderBand(props: Partial<React.ComponentProps<typeof FocusBand>> = {}) {
  return render(
    <MemoryRouter>
      <FocusBand topics={[topic]} totals={{ learned: 4, learning: 2, total: 10 }} onToggleFocus={() => {}} {...props} />
    </MemoryRouter>,
  )
}

describe('FocusBand', () => {
  it('shows the combined counts and the Fokus topics', () => {
    renderBand()

    expect(screen.getByRole('heading', { name: 'Fokus' })).toBeInTheDocument()
    expect(screen.getByText('4 sicher gelernt · 2 teilweise · 4 offen (von 10 Fragen)')).toBeInTheDocument()
    expect(screen.getByText('Ankern (Navigation)')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Lernen starten' })).toHaveAttribute('href', '/learn/navigation/ankern')
  })

  it('falls back to the raw subject key for an unknown subject', () => {
    renderBand({ topics: [{ ...topic, subject: 'neu' }] })

    expect(screen.getByText('Ankern (neu)')).toBeInTheDocument()
  })

  it('hints at the star when there is no Fokus topic', () => {
    renderBand({ topics: [], totals: { learned: 0, learning: 0, total: 0 } })

    expect(screen.getByText(/Markiere Themen mit dem Stern/)).toBeInTheDocument()
    expect(screen.queryByText(/sicher gelernt ·/)).not.toBeInTheDocument()
  })

  it('unmarks a topic via its star', async () => {
    const onToggleFocus = vi.fn()
    renderBand({ onToggleFocus })

    await userEvent.click(screen.getByRole('button', { name: 'Fokus entfernen: Ankern (Navigation)' }))

    expect(onToggleFocus).toHaveBeenCalledWith(topic)
  })

  it('shows an error message', () => {
    renderBand({ error: 'Der Fokus konnte nicht gespeichert werden.' })

    expect(screen.getByText('Der Fokus konnte nicht gespeichert werden.')).toBeInTheDocument()
  })
})
