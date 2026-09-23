import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ShareLinks } from './ShareLinks'

describe('ShareLinks', () => {
  it('offers WhatsApp, X, and e-mail share links for the site', () => {
    render(<ShareLinks />)

    expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
      'href',
      'https://wa.me/?text=SKS%20Lotse%20%E2%80%93%20online%20f%C3%BCr%20die%20SKS-Theoriepr%C3%BCfung%20lernen%20https%3A%2F%2Fsks-lotse.de',
    )
    expect(screen.getByRole('link', { name: 'X' })).toHaveAttribute(
      'href',
      'https://twitter.com/intent/tweet?text=SKS%20Lotse%20%E2%80%93%20online%20f%C3%BCr%20die%20SKS-Theoriepr%C3%BCfung%20lernen&url=https%3A%2F%2Fsks-lotse.de',
    )
    expect(screen.getByRole('link', { name: 'E-Mail' })).toHaveAttribute(
      'href',
      'mailto:?subject=SKS%20Lotse%20%E2%80%93%20online%20f%C3%BCr%20die%20SKS-Theoriepr%C3%BCfung%20lernen&body=https%3A%2F%2Fsks-lotse.de',
    )
  })
})
