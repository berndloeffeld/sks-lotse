import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { PublicPricing } from '../api/types'
import { checkLimitsSource } from '../../shared/checkLimits'
import { SignupBonusNote } from './SignupBonusNote'

function primeBonus(tokens: number) {
  checkLimitsSource.reset()
  checkLimitsSource.prime({
    catalog_check_tokens: 1,
    chart_check_tokens: 2,
    sbf_navigation_check_tokens: 2,
    check_max_answer_chars: 1000,
    signup_bonus_tokens: tokens,
  } as PublicPricing)
}

describe('SignupBonusNote', () => {
  it('names the bonus from /pricing', () => {
    primeBonus(8)
    render(<SignupBonusNote />)

    expect(screen.getByText(/Auswertungen geschenkt$/)).toHaveTextContent(
      'Mit Anmeldung 8 Tokens für KI-gestützte Auswertungen geschenkt',
    )
  })

  it('leaves the number out until /pricing has answered', () => {
    checkLimitsSource.reset()
    // Never answers: the note keeps showing the stand-in.
    checkLimitsSource.load(() => new Promise(() => {})).catch(() => {})
    render(<SignupBonusNote />)

    expect(screen.getByText(/Auswertungen geschenkt$/)).toHaveTextContent(
      'Mit Anmeldung Tokens für KI-gestützte Auswertungen geschenkt',
    )
  })

  it('shows nothing when new accounts get no tokens', () => {
    primeBonus(0)
    const { container } = render(<SignupBonusNote />)

    expect(container).toBeEmptyDOMElement()
  })
})
