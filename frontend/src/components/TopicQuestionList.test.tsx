import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { Question } from '../api/types'
import { TopicQuestionList } from './TopicQuestionList'

const QUESTIONS: Question[] = [
  {
    id: 1,
    subject: 'navigation',
    number: 29,
    topic: 'seekarten',
    question_text: 'Wo sind die Symbole erklärt?',
    answer_text: 'In der Karte 1.',
    question_images: [{ src: 'frage.png', width: 300, height: 100 }],
    answer_images: [],
  },
  {
    id: 2,
    subject: 'navigation',
    number: 30,
    topic: 'seekarten',
    question_text: 'Skizziere die Lichter.',
    answer_text: '',
    question_images: [],
    answer_images: [{ src: 'skizze.png', width: 300, height: 100 }],
  },
]

describe('TopicQuestionList', () => {
  it('lists every question folded shut, each with an anchor, its answer in the page', async () => {
    const { container } = render(<TopicQuestionList questions={QUESTIONS} />)
    const list = screen.getByRole('region', { name: 'Alle Fragen dieses Themas' })

    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(container.querySelector('#frage-29')).toHaveTextContent('Nr. 29')
    const details = container.querySelectorAll('details')
    expect([...details].every((d) => !d.open)).toBe(true)
    // In the HTML (for search engines), though hidden until opened.
    expect(container).toHaveTextContent('In der Karte 1.')

    await userEvent.click(screen.getByText('Wo sind die Symbole erklärt?'))
    expect(details[0].open).toBe(true)
    expect(within(details[0]).getByRole('img', { name: 'Abbildung zur Frage' })).toBeInTheDocument()
    expect(within(details[1]).getByRole('img', { name: 'Abbildung zur amtlichen Antwort' })).toBeInTheDocument()
  })
})
