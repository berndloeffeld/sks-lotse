import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { PublicPricing } from '../api/types'
import { checkLimitsSource } from '../checkLimits'
import { SignupBonusNote } from './SignupBonusNote'

function primeBonus(tokens: number) {
  checkLimitsSource.reset()
  checkLimitsSource.prime({
    catalog_check_tokens: 1,
    chart_check_tokens: 2,
    check_max_answer_chars: 1000,
    signup_bonus_tokens: tokens,
  } as PublicPricing)
}

describe('SignupBonusNote', () => {
  it('names the bonus from /pricing in the box above the login form', () => {
    primeBonus(10)
    render(<SignupBonusNote variant="box" />)

    expect(screen.getByText(/Jetzt anmelden und/)).toHaveTextContent(
      'Jetzt anmelden und 10 Tokens für KI-gestützte Auswertungen deiner Antworten geschenkt bekommen.',
    )
    expect(screen.getByText(/Jetzt anmelden/).closest('p')).toHaveClass('border-primary')
  })

  it('takes the dark band tone', () => {
    primeBonus(10)
    render(<SignupBonusNote variant="box" tone="dark" />)

    expect(screen.getByText(/Jetzt anmelden/).closest('p')).toHaveClass('border-surface')
  })

  it('says it in one line under the hero button', () => {
    primeBonus(8)
    render(<SignupBonusNote variant="line" />)

    expect(screen.getByText(/Auswertungen geschenkt$/)).toHaveTextContent(
      'Mit Anmeldung 8 Tokens für KI-gestützte Auswertungen geschenkt',
    )
  })

  it('leaves the number out until /pricing has answered', () => {
    checkLimitsSource.reset()
    // Never answers: the note keeps showing the stand-in.
    checkLimitsSource.load(() => new Promise(() => {})).catch(() => {})
    render(<SignupBonusNote variant="box" />)

    expect(screen.getByText(/Jetzt anmelden und/)).toHaveTextContent(
      'Jetzt anmelden und Tokens für KI-gestützte Auswertungen deiner Antworten geschenkt bekommen.',
    )
  })

  it('shows nothing when new accounts get no tokens', () => {
    primeBonus(0)
    const { container } = render(<SignupBonusNote variant="box" />)

    expect(container).toBeEmptyDOMElement()
  })
})
