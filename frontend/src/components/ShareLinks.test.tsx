import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ShareLinks } from './ShareLinks'

describe('ShareLinks', () => {
  it('opens a WhatsApp share dialog for the site', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<ShareLinks />)

    await userEvent.click(screen.getByRole('button', { name: 'Auf WhatsApp teilen' }))

    expect(open).toHaveBeenCalledTimes(1)
    const [url] = open.mock.calls[0]
    expect(url).toContain('https://api.whatsapp.com/send')
    expect(url).toContain(encodeURIComponent('sks-lotse.de'))
  })

  it('opens a Facebook share dialog for the site', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<ShareLinks />)

    await userEvent.click(screen.getByRole('button', { name: 'Auf Facebook teilen' }))

    expect(open).toHaveBeenCalledTimes(1)
    const [url] = open.mock.calls[0]
    expect(url).toContain('https://www.facebook.com/sharer/sharer.php')
    expect(url).toContain(encodeURIComponent('sks-lotse.de'))
  })

  it('opens a Telegram share dialog for the site', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<ShareLinks />)

    await userEvent.click(screen.getByRole('button', { name: 'Auf Telegram teilen' }))

    expect(open).toHaveBeenCalledTimes(1)
    const [url] = open.mock.calls[0]
    expect(url).toContain('https://telegram.me/share/url')
    expect(url).toContain(encodeURIComponent('sks-lotse.de'))
  })

  it('opens a mailto share dialog for the site', async () => {
    // The email button navigates via `window.location.href` instead of
    // opening a popup — stub `location` so that assignment is observable.
    const location = { href: '' }
    vi.stubGlobal('location', location)
    render(<ShareLinks />)

    await userEvent.click(screen.getByRole('button', { name: 'Per E-Mail teilen' }))

    expect(location.href).toContain('mailto:')
    expect(location.href).toContain(encodeURIComponent('SKS Lotse'))
  })
})
