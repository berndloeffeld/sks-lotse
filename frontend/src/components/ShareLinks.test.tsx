import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ShareLinks } from './ShareLinks'

function linkFor(name: string): HTMLAnchorElement {
  render(<ShareLinks />)
  return screen.getByRole('link', { name }) as HTMLAnchorElement
}

describe('ShareLinks', () => {
  it('links to a WhatsApp share dialog for the site, in a new tab', () => {
    const link = linkFor('Auf WhatsApp teilen')

    expect(link.href).toContain('https://api.whatsapp.com/send')
    expect(link.href).toContain(encodeURIComponent('sks-lotse.de'))
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('links to a Facebook share dialog for the site, in a new tab', () => {
    const link = linkFor('Auf Facebook teilen')

    expect(link.href).toContain('https://www.facebook.com/sharer/sharer.php')
    expect(link.href).toContain(encodeURIComponent('sks-lotse.de'))
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('links to a Telegram share dialog for the site, in a new tab', () => {
    const link = linkFor('Auf Telegram teilen')

    expect(link.href).toContain('https://telegram.me/share/url')
    expect(link.href).toContain(encodeURIComponent('sks-lotse.de'))
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('links to a mail with the site, without opening a tab', () => {
    const link = linkFor('Per E-Mail teilen')

    expect(link.href).toContain('mailto:')
    expect(link.href).toContain(encodeURIComponent('SKS Lotse'))
    expect(link).not.toHaveAttribute('target')
  })
})
