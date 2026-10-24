import { analyticsLoaded } from '../../shared/analytics'
import { AccountMenu, type AccountMenuPlacement } from '../../shared/components/AccountMenu'
import { useAuthStore } from '../../shared/store/authStore'

// SKS Lotse's Konto menu: Lernstand, account settings, buying tokens, and Admin for admins.
export function SksAccountMenu({ placement }: { placement?: AccountMenuPlacement }) {
  const isAdmin = useAuthStore((state) => state.user?.is_admin ?? false)
  const links = [
    { to: '/profile', label: 'Lernstand' },
    { to: '/profile/account', label: 'Kontoeinstellungen' },
    { to: '/pricing', label: 'Tokens kaufen' },
    // A document running Umami goes to the admin tools by a full page load right away, instead of
    // rendering them in-app first and then being reloaded by useAdminWithoutAnalytics (the page
    // flickered twice).
    ...(isAdmin ? [{ to: '/admin', label: 'Admin', reloadDocument: analyticsLoaded() }] : []),
  ]
  return <AccountMenu links={links} placement={placement} />
}
