import { AccountMenu } from '../shared/components/AccountMenu'

// SBF Lotse's Konto menu (ADR-0070): no admin here, that stays on sks-lotse.de.
const LINKS = [
  { to: '/profile/account', label: 'Kontoeinstellungen' },
  { to: '/pricing', label: 'Tokens kaufen' },
]

export function SbfAccountMenu() {
  return <AccountMenu links={LINKS} />
}
