import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AdminQuestionsPage } from './AdminQuestionsPage'
import { jsonResponse } from '../test/fixtures'

const anchorQuestion = {
  id: 301,
  subject: 'seemannschaft_allgemein',
  number: 3,
  question_text: 'Wie ankert man?',
  answer_text: 'Mit dem Anker.',
  question_images: [],
  answer_images: [{ src: 'anker.png', width: 300, height: 200 }],
  topic: 'ankern',
}

function stubFetch(respond: (params: URLSearchParams) => Response, topics: unknown[] = []) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost')
    if (url.pathname.endsWith('/admin/questions')) return respond(url.searchParams)
    if (url.pathname.endsWith('/topics')) return jsonResponse(topics)
    throw new Error(`unexpected fetch to ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// The query of the last catalog search the page sent (topic lookups aside).
function lastSearch(fetchMock: ReturnType<typeof stubFetch>) {
  const urls = fetchMock.mock.calls.map(([input]) => new URL(String(input), 'http://localhost'))
  const searches = urls.filter((url) => url.pathname.endsWith('/admin/questions'))
  return Object.fromEntries(searches[searches.length - 1].searchParams)
}

describe('AdminQuestionsPage', () => {
  it('loads nothing until a term or a subject is given', async () => {
    const fetchMock = stubFetch(() => jsonResponse([]))
    render(<AdminQuestionsPage />)

    expect(await screen.findByText('Suchbegriff eingeben oder ein Fach wählen.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('searches by term and shows question, official answer and images', async () => {
    const user = userEvent.setup()
    const fetchMock = stubFetch(() => jsonResponse([anchorQuestion]))
    render(<AdminQuestionsPage />)

    await user.type(screen.getByLabelText('Text oder Nummer'), ' anker ')
    await user.click(screen.getByRole('button', { name: 'Suchen' }))

    expect(await screen.findByText('1 Frage')).toBeInTheDocument()
    const item = screen.getByRole('listitem')
    expect(within(item).getByText('Seemannschaft · Nr. 3 · ID 301 · ankern')).toBeInTheDocument()
    expect(within(item).getByText('Wie ankert man?')).toBeInTheDocument()
    expect(within(item).getByText('Mit dem Anker.')).toBeInTheDocument()
    expect(within(item).getByRole('img', { name: 'Abbildung zur amtlichen Antwort' })).toBeInTheDocument()
    const params = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost').searchParams
    expect(Object.fromEntries(params)).toEqual({ q: 'anker' })
  })

  it('filters by subject alone', async () => {
    const user = userEvent.setup()
    const fetchMock = stubFetch(() =>
      jsonResponse([
        { ...anchorQuestion, id: 1, subject: 'navigation', number: 1, topic: null },
        { ...anchorQuestion, id: 2, subject: 'navigation', number: 2, topic: null },
      ]),
    )
    render(<AdminQuestionsPage />)

    await user.selectOptions(screen.getByLabelText('Fach'), 'navigation')
    await user.click(screen.getByRole('button', { name: 'Suchen' }))

    expect(await screen.findByText('2 Fragen')).toBeInTheDocument()
    expect(screen.getByText('Navigation · Nr. 1 · ID 1')).toBeInTheDocument()
    expect(lastSearch(fetchMock)).toEqual({ q: '', subject: 'navigation' })
  })

  it('offers the topics of the chosen subject and filters by one', async () => {
    const user = userEvent.setup()
    const fetchMock = stubFetch(
      () => jsonResponse([{ ...anchorQuestion, id: 1, subject: 'navigation', number: 1, topic: 'kompass' }]),
      [
        { subject: 'navigation', slug: 'kompass', name: 'Kompass', display_order: 1 },
        { subject: 'navigation', slug: 'gezeiten', name: 'Gezeiten', display_order: 2 },
      ],
    )
    render(<AdminQuestionsPage />)

    expect(screen.queryByLabelText('Thema')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Fach'), 'navigation')
    await user.selectOptions(await screen.findByLabelText('Thema'), 'Kompass')
    await user.click(screen.getByRole('button', { name: 'Suchen' }))

    expect(await screen.findByText('1 Frage')).toBeInTheDocument()
    expect(lastSearch(fetchMock)).toEqual({ q: '', subject: 'navigation', topic: 'kompass' })

    // Another subject has other topics: the choice is reset rather than sent with it.
    await user.selectOptions(screen.getByLabelText('Fach'), 'seemannschaft_allgemein')
    await user.click(screen.getByRole('button', { name: 'Suchen' }))
    await vi.waitFor(() => expect(lastSearch(fetchMock)).toEqual({ q: '', subject: 'seemannschaft_allgemein' }))
  })

  it('shows the sketch image without an empty official-answer paragraph when only the text is missing', async () => {
    const user = userEvent.setup()
    stubFetch(() =>
      jsonResponse([
        { ...anchorQuestion, answer_text: '', answer_images: [{ src: 'skizze.png', width: 100, height: 80 }] },
      ]),
    )
    render(<AdminQuestionsPage />)

    await user.type(screen.getByLabelText('Text oder Nummer'), 'anker')
    await user.click(screen.getByRole('button', { name: 'Suchen' }))

    expect(await screen.findByText('1 Frage')).toBeInTheDocument()
    expect(screen.queryByText(/Skizze/)).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Abbildung zur amtlichen Antwort' })).toBeInTheDocument()
  })

  it('explains a sketch-only official answer when both its text and its image are missing', async () => {
    const user = userEvent.setup()
    stubFetch(() => jsonResponse([{ ...anchorQuestion, answer_text: '', answer_images: [] }]))
    render(<AdminQuestionsPage />)

    await user.type(screen.getByLabelText('Text oder Nummer'), 'anker')
    await user.click(screen.getByRole('button', { name: 'Suchen' }))

    expect(
      await screen.findByText(
        'Die amtliche Antwort zu dieser Frage besteht nur aus einer Skizze, die SKS Lotse nicht anzeigen kann.',
      ),
    ).toBeInTheDocument()
  })

  it('shows an unknown subject by its key', async () => {
    const user = userEvent.setup()
    stubFetch(() => jsonResponse([{ ...anchorQuestion, subject: 'neu', topic: null }]))
    render(<AdminQuestionsPage />)

    await user.type(screen.getByLabelText('Text oder Nummer'), '3')
    await user.click(screen.getByRole('button', { name: 'Suchen' }))

    expect(await screen.findByText('neu · Nr. 3 · ID 301')).toBeInTheDocument()
  })

  it('shows zero results', async () => {
    const user = userEvent.setup()
    stubFetch(() => jsonResponse([]))
    render(<AdminQuestionsPage />)

    await user.type(screen.getByLabelText('Text oder Nummer'), 'xyz')
    await user.click(screen.getByRole('button', { name: 'Suchen' }))

    expect(await screen.findByText('0 Fragen')).toBeInTheDocument()
  })

  it('shows an error when the search fails', async () => {
    const user = userEvent.setup()
    stubFetch(() => new Response(null, { status: 500 }))
    render(<AdminQuestionsPage />)

    await user.type(screen.getByLabelText('Text oder Nummer'), 'anker')
    await user.click(screen.getByRole('button', { name: 'Suchen' }))

    expect(await screen.findByText('Die Suche ist fehlgeschlagen.')).toBeInTheDocument()
  })
})
