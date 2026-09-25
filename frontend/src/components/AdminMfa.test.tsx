import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { jsonResponse } from '../test/fixtures'
import { AdminMfaEnrol, AdminMfaVerify } from './AdminMfa'

const ENROLMENT = {
  secret: 'JBSWY3DPEHPK3PXP',
  otpauth_uri: 'otpauth://totp/SKS%20Lotse:admin%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=SKS%20Lotse',
  qr_code: 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E',
}

function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn()
  for (const response of responses) fetchMock.mockResolvedValueOnce(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function bodyOf(fetchMock: ReturnType<typeof vi.fn>, call: number) {
  return JSON.parse(fetchMock.mock.calls[call][1].body as string)
}

describe('AdminMfaEnrol', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts the enrolment on request, shows QR code and key, and activates with the first code', async () => {
    const fetchMock = stubFetch(jsonResponse(ENROLMENT), jsonResponse({ access_token: 't', token_type: 'bearer' }))
    const onVerified = vi.fn()
    render(<AdminMfaEnrol onVerified={onVerified} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Einrichtung starten' }))

    expect(await screen.findByRole('img', { name: 'QR-Code für die Authenticator-App' })).toHaveAttribute(
      'src',
      ENROLMENT.qr_code,
    )
    expect(screen.getByText(ENROLMENT.secret)).toBeInTheDocument()
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/admin\/mfa\/enrol$/)

    await userEvent.type(screen.getByLabelText('Code aus der Authenticator-App'), '123 456')
    await userEvent.click(screen.getByRole('button', { name: 'Aktivieren' }))

    expect(fetchMock.mock.calls[1][0]).toMatch(/\/admin\/mfa\/verify$/)
    expect(bodyOf(fetchMock, 1)).toEqual({ code: '123456' })
    expect(onVerified).toHaveBeenCalledOnce()
  })

  it('says so when the enrolment cannot start', async () => {
    stubFetch(jsonResponse({ detail: '2FA is already enabled' }, 409))
    render(<AdminMfaEnrol onVerified={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Einrichtung starten' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Einrichtung konnte nicht gestartet werden.')
  })
})

describe('AdminMfaVerify', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function submit(code: string) {
    await userEvent.type(screen.getByLabelText('Code aus der Authenticator-App'), code)
    await userEvent.click(screen.getByRole('button', { name: 'Bestätigen' }))
  }

  it('opens the admin area with a valid code', async () => {
    const fetchMock = stubFetch(jsonResponse({ access_token: 't', token_type: 'bearer' }))
    const onVerified = vi.fn()
    render(<AdminMfaVerify onVerified={onVerified} />)

    await submit('654321')

    expect(bodyOf(fetchMock, 0)).toEqual({ code: '654321' })
    expect(onVerified).toHaveBeenCalledOnce()
  })

  it.each([
    [400, 'Der Code ist ungültig.'],
    [429, 'Zu viele Versuche.'],
    [500, 'Die Prüfung ist fehlgeschlagen.'],
  ])('explains a %i', async (status, message) => {
    stubFetch(jsonResponse({ detail: 'x' }, status))
    const onVerified = vi.fn()
    render(<AdminMfaVerify onVerified={onVerified} />)

    await submit('000000')

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(onVerified).not.toHaveBeenCalled()
  })
})
