import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SsoButton } from './SsoButton'

describe('SsoButton', () => {
  afterEach(() => {
    delete window.umami
  })

  it.each([
    ['google', 'Mit Google anmelden'],
    ['facebook', 'Mit Facebook anmelden'],
  ] as const)('links %s to the backend start route and hides the decorative logo', (provider, label) => {
    render(<SsoButton provider={provider} />)

    const link = screen.getByRole('link', { name: label })
    expect(link).toHaveAttribute('href', expect.stringMatching(new RegExp(`/api/v1/auth/sso/${provider}/start$`)))
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('tracks the click with the provider only', () => {
    const track = vi.fn()
    window.umami = { track }
    render(<SsoButton provider="google" />)

    const link = screen.getByRole('link', { name: 'Mit Google anmelden' })
    link.addEventListener('click', (event) => event.preventDefault()) // no real navigation in jsdom
    fireEvent.click(link)

    expect(track).toHaveBeenCalledWith('login_sso', { provider: 'google' })
  })
})
