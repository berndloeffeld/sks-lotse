import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import samples from '../data/landing_samples.gen.json'
import { HeroSampleQuestion } from './HeroSampleQuestion'

const [first, second] = samples.questions

function renderSample(track = true) {
  return render(
    <MemoryRouter>
      <HeroSampleQuestion track={track} />
    </MemoryRouter>,
  )
}

async function answerAndGrade(answer: string, grade: string) {
  if (answer) await userEvent.type(screen.getByLabelText('Deine Antwort'), answer)
  await userEvent.click(screen.getByRole('button', { name: 'Lösung anzeigen' }))
  await userEvent.click(screen.getByRole('radio', { name: grade }))
  await userEvent.click(screen.getByRole('button', { name: 'Weiter' }))
}

describe('HeroSampleQuestion', () => {
  afterEach(() => {
    delete window.umami
  })

  it('starts with the first sample, word for word from the export', () => {
    renderSample()

    expect(screen.getByRole('heading', { name: first.question_text })).toBeInTheDocument()
    expect(screen.getByText(/Probier’s aus · Schifffahrtsrecht · Nr/)).toHaveTextContent(`Nr. ${first.number}`)
    expect(screen.queryByText(first.answer_text)).not.toBeInTheDocument()
  })

  it('compares the answer with the official one, takes a grade and leads on to the topic', async () => {
    const track = vi.fn()
    window.umami = { track }
    renderSample()

    await userEvent.type(screen.getByLabelText('Deine Antwort'), 'Peilung steht')
    await userEvent.click(screen.getByRole('button', { name: 'Lösung anzeigen' }))
    expect(track).toHaveBeenLastCalledWith('landing_sample_revealed', undefined)
    expect(screen.getByText('Peilung steht')).toBeInTheDocument()
    expect(screen.getByText(first.answer_text)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: 'Teilweise richtig' }))
    await userEvent.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(track).toHaveBeenLastCalledWith('landing_sample_graded', { outcome: 'teilweise_richtig' })
    expect(screen.getByRole('status')).toHaveTextContent('Fast. Mit Konto kommt diese Frage wieder')

    const topic = screen.getByRole('link', { name: `Alle Fragen zu „${first.topic_name}“` })
    expect(topic).toHaveAttribute('href', `/learn/${first.subject}/${first.topic}`)
    await userEvent.click(topic)
    expect(track).toHaveBeenLastCalledWith('landing_link_clicked', { target: 'sample_topic' })
  })

  it.each([
    ['Richtig', 'Sitzt.'],
    ['Falsch', 'Kein Problem.'],
  ])('answers the grade %s', async (grade, feedback) => {
    renderSample()
    await answerAndGrade('', grade)
    expect(screen.getByRole('status')).toHaveTextContent(feedback)
  })

  it('reveals without an answer, showing no own answer', async () => {
    renderSample()
    await userEvent.click(screen.getByRole('button', { name: 'Lösung anzeigen' }))
    expect(screen.queryByRole('heading', { name: 'Deine Antwort' })).not.toBeInTheDocument()
    expect(screen.getByText(first.answer_text)).toBeInTheDocument()
  })

  it('offers the next sample with a fresh answer field, and wraps around', async () => {
    renderSample()
    await answerAndGrade('irgendwas', 'Richtig')
    await userEvent.click(screen.getByRole('button', { name: 'Andere Beispielfrage' }))

    expect(screen.getByRole('heading', { name: second.question_text })).toBeInTheDocument()
    expect(screen.getByLabelText('Deine Antwort')).toHaveValue('')

    for (let i = 1; i < samples.questions.length; i++) {
      await answerAndGrade('', 'Richtig')
      await userEvent.click(screen.getByRole('button', { name: 'Andere Beispielfrage' }))
    }
    expect(screen.getByRole('heading', { name: first.question_text })).toBeInTheDocument()
  })

  it('counts nothing when told not to (a logged-in visitor)', async () => {
    const track = vi.fn()
    window.umami = { track }
    renderSample(false)
    await answerAndGrade('x', 'Richtig')
    await userEvent.click(screen.getByRole('link', { name: /Alle Fragen zu/ }))
    expect(track).not.toHaveBeenCalled()
  })
})
