import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { navigationSource } from './navigationCatalog'
import { navigationExportFixture } from './navigationFixture'
import { sbfRoutes } from './routes'

// The subtask being worked on (the history beside it repeats the done ones).
function currentSubtask(number: number) {
  return within(screen.getByText(`Teilaufgabe ${number} von 3`).closest('section')!)
}

function renderAt(path: string) {
  return render(<RouterProvider router={createMemoryRouter(sbfRoutes, { initialEntries: [path] })} />)
}

describe('Navigationsaufgaben for guests', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubEnv('VITE_SITE', 'sbf')
    vi.stubEnv('VITE_SBF', 'on')
    vi.stubGlobal('fetch', fetchMock)
    navigationSource.prime(navigationExportFixture())
  })

  afterEach(() => navigationSource.reset())

  it('lists the tasks with the hints, the chart named in one sentence', () => {
    renderAt('/navigation')

    expect(screen.getByRole('link', { name: 'Navigationsaufgabe 2' })).toHaveAttribute('href', '/navigation/2')
    expect(screen.getByText('Den Navigationsaufgaben liegt die Übungskarte D49 zugrunde.')).toBeInTheDocument()
    expect(screen.queryByText(/E007°43,12'/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Navigationsaufgaben' })).toHaveAttribute('href', '/navigation')
  })

  it('shows a task with its situation and starts the run', async () => {
    const user = userEvent.setup()
    renderAt('/navigation/1')

    expect(screen.getByText('Die Fahrt über Grund beträgt 8 kn.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Aufgabe starten' }))
    expect(screen.getByText('Teilaufgabe 1 von 3')).toBeInTheDocument()
    expect(screen.getByLabelText('Deine Antwort')).toHaveFocus()
  })

  it('runs by keyboard as SKS Lotse does: Enter shows the result, Tab cycles the points, Enter gives them', async () => {
    const user = userEvent.setup()
    renderAt('/navigation/1?run=1')

    await user.keyboard('rwK = 078°{Shift>}{Enter}{/Shift}geschätzt')
    expect(screen.getByLabelText('Deine Antwort')).toHaveValue('rwK = 078°\ngeschätzt')
    await user.keyboard('{Enter}')

    const result = currentSubtask(1).getByText('Amtliches Ergebnis').parentElement!
    expect(within(result).getByText('rwK = 079°')).toBeInTheDocument()
    expect(
      within(result).getByText(/Tippfehler im amtlichen Text korrigiert, dort steht „rwk = 079°“/),
    ).toBeInTheDocument()
    expect(within(result).getByText(/Toleranz: ±1°/)).toHaveTextContent('nicht amtlich, übliche Prüfungspraxis')

    await user.keyboard('{Tab}')
    expect(screen.getByRole('radio', { name: '0' })).toHaveFocus()
    await user.keyboard('{Tab}')
    expect(screen.getByRole('radio', { name: '1' })).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(screen.getByText('Teilaufgabe 2 von 3')).toBeInTheDocument()
    expect(screen.getByLabelText('Deine Antwort')).toHaveFocus()
  })

  it('shows the current subtask in the original, its result only once answered', async () => {
    const user = userEvent.setup()
    renderAt('/navigation/1?run=1')
    const panel = screen.getAllByRole('complementary', { name: 'Hilfsmittel' })[0]

    await user.click(within(panel).getByRole('button', { name: /Offizieller Originaltext/ }))
    const question = within(panel).getByRole('img', { name: 'Teilaufgabe 1 der Navigationsaufgabe 1 im Original' })
    expect(question).toHaveAttribute('src', '/navigation/originals/aufgabe-01-1-aufgabe.png')
    expect(within(panel).queryByRole('img', { name: /^Ergebnis/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ergebnis anzeigen' }))
    expect(within(panel).getByRole('img', { name: /^Ergebnis zu Teilaufgabe 1/ })).toHaveAttribute(
      'src',
      '/navigation/originals/aufgabe-01-1-ergebnis.png',
    )

    await user.click(screen.getByRole('radio', { name: '1' }))
    await user.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(
      within(panel).getByRole('img', { name: 'Teilaufgabe 2 der Navigationsaufgabe 1 im Original' }),
    ).toBeInTheDocument()
    expect(within(panel).queryByRole('img', { name: /^Ergebnis/ })).not.toBeInTheDocument()
  })

  it('goes on from the answer field to the button with Tab', async () => {
    const user = userEvent.setup()
    renderAt('/navigation/1?run=1')

    await user.keyboard('{Tab}')
    expect(screen.getByRole('button', { name: 'Ergebnis anzeigen' })).toHaveFocus()
  })

  it('asks for points before going on, shows footnotes, and ends with the evaluation', async () => {
    const user = userEvent.setup()
    renderAt('/navigation/1?run=1')

    await user.click(screen.getByRole('button', { name: 'Ergebnis anzeigen' }))
    await user.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(screen.getByText('Wähle zuerst, wie viele Punkte du dir gibst.')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: '1' }))
    await user.click(screen.getByRole('button', { name: 'Weiter' }))

    await user.click(screen.getByRole('button', { name: 'Ergebnis anzeigen' }))
    expect(currentSubtask(2).getByText('*) Der MgK lautet tatsächlich: 074°')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: '0' }))
    await user.click(screen.getByRole('button', { name: 'Weiter' }))

    await user.click(screen.getByRole('button', { name: 'Ergebnis anzeigen' }))
    expect(currentSubtask(3).queryByText(/Toleranz:/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: '1' }))
    await user.click(screen.getByRole('button', { name: 'Weiter' }))

    const evaluation = screen.getByRole('region', { name: 'Auswertung' })
    expect(evaluation).toHaveTextContent('2 von 3 Punkten: bestanden')
    const history = screen.getAllByRole('complementary', { name: 'Hilfsmittel' })[0]
    expect(within(history).getByText('Teilaufgabe 2')).toBeInTheDocument()
    expect(within(history).getByText('0 / 1 Punkt')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Noch einmal' }))
    expect(screen.getByText('Teilaufgabe 1 von 3')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('says when a task does not exist', () => {
    renderAt('/navigation/99')
    expect(screen.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeInTheDocument()
  })

  it('has no Navigationsaufgaben in a build without them', () => {
    vi.stubEnv('VITE_SBF', 'off')
    renderAt('/navigation')
    expect(screen.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeInTheDocument()
  })
})
