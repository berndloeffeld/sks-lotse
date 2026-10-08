import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AdminQuestionHistory } from './AdminQuestionHistory'
import { jsonResponse } from '../test/fixtures'

function stubFetch(response: () => Response) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (!String(input).endsWith('/admin/questions/301/history')) throw new Error(`unexpected fetch to ${input}`)
    return response()
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderHistory() {
  return render(
    <MemoryRouter>
      <AdminQuestionHistory questionId={301} />
    </MemoryRouter>,
  )
}

const open = () => userEvent.setup().click(screen.getByRole('button', { name: 'Antwortverlauf anzeigen' }))

describe('AdminQuestionHistory', () => {
  it('loads nothing until opened', () => {
    const fetchMock = stubFetch(() => jsonResponse({ question_id: 301, users: [] }))
    renderHistory()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows the most recent learner first and switches learners via the picker', async () => {
    stubFetch(() =>
      jsonResponse({
        question_id: 301,
        users: [
          {
            user_id: 7,
            email: 'anna@example.com',
            gradings: [
              { graded_at: '2026-09-01T10:00:00Z', outcome: 'richtig', half_life_days: 2.5 },
              { graded_at: '2026-09-03T10:00:00Z', outcome: 'teilweise_richtig', half_life_days: 1 },
            ],
          },
          {
            user_id: 8,
            email: 'carl@example.com',
            gradings: [{ graded_at: '2026-08-20T10:00:00Z', outcome: 'falsch', half_life_days: 0.25 }],
          },
        ],
      }),
    )
    renderHistory()
    await open()

    const picker = await screen.findByRole('combobox', { name: 'Nutzer' })
    expect(screen.getByText('2 Nutzer')).toBeInTheDocument()
    expect(picker).toHaveDisplayValue('anna@example.com')
    expect(screen.getByRole('link', { name: 'Zum Konto' })).toHaveAttribute('href', '/admin/users/7')
    let rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('Richtig')).toBeInTheDocument()
    expect(within(rows[0]).getByText('2,5 Tage')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Teilweise richtig')).toBeInTheDocument()
    expect(within(rows[1]).getByText('1 Tag')).toBeInTheDocument()

    await userEvent.setup().selectOptions(picker, 'carl@example.com')
    expect(screen.getByRole('link', { name: 'Zum Konto' })).toHaveAttribute('href', '/admin/users/8')
    rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(1)
    expect(within(rows[0]).getByText('Falsch')).toBeInTheDocument()
    expect(within(rows[0]).getByText('0,25 Tage')).toBeInTheDocument()
  })

  it('says so when nobody graded the question yet, and closes again', async () => {
    stubFetch(() => jsonResponse({ question_id: 301, users: [] }))
    renderHistory()
    await open()

    expect(await screen.findByText('Noch von niemandem bewertet.')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Antwortverlauf ausblenden' }))
    expect(screen.queryByText('Noch von niemandem bewertet.')).not.toBeInTheDocument()
  })

  it('reports a failed load', async () => {
    stubFetch(() => jsonResponse({ detail: 'boom' }, 500))
    renderHistory()
    await open()

    expect(await screen.findByText('Der Verlauf ließ sich nicht laden.')).toBeInTheDocument()
  })
})
