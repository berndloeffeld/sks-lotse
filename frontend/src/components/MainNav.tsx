import { Link, useLocation } from 'react-router-dom'

import { isActive, mainNavItems } from '../navigation'
import { useAuthStore } from '../store/authStore'
import { AccountMenu } from './AccountMenu'
import { TokenCounter } from './TokenCounter'
import { HEADER_LINK, HEADER_LINK_ACTIVE } from './headerLink'

// Header nav for logged-in pages: the areas (navigation.ts), the token balance and the Konto menu.
// On phones only the token balance stays up here; the areas and the menu move to the tab bar
// (MobileTabBar).
export function MainNav() {
  const { pathname } = useLocation()
  const chartExercises = useAuthStore((state) => state.user?.can_use_chart_exercises ?? false)

  return (
    <nav aria-label="Hauptnavigation" className="ml-auto flex flex-wrap items-baseline justify-end gap-x-5 gap-y-2">
      {mainNavItems(chartExercises).map((item) => {
        const active = isActive(item, pathname)
        return (
          <Link
            key={item.label}
            to={item.to}
            aria-current={active ? 'page' : undefined}
            className={`hidden md:inline ${active ? HEADER_LINK_ACTIVE : HEADER_LINK}`}
          >
            {item.label}
          </Link>
        )
      })}
      <TokenCounter />
      <div className="hidden md:block">
        <AccountMenu />
      </div>
    </nav>
  )
}
