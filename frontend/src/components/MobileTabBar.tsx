import { Link, useLocation } from 'react-router-dom'

import { isActive, mainNavItems, type NavIcon } from '../navigation'
import { useAuthStore } from '../store/authStore'
import { AccountMenu } from './AccountMenu'
import { tabBarItemClass } from './headerLink'
import { CatalogIcon, ChartDividersIcon, ExamIcon } from './icons/FeatureIcons'

const ICONS: Record<NavIcon, typeof CatalogIcon> = {
  catalog: CatalogIcon,
  exam: ExamIcon,
  charts: ChartDividersIcon,
}

// The phones' navigation (below `md`): the areas of the header plus the Konto menu as a tab bar at
// the bottom of the screen, within thumb reach. Pages that run a practice, exam or chart session
// leave it out (PageLayout's `immersive`), so the keyboard and the task get the whole screen.
// The spacer keeps the footer's last line out from under the fixed bar.
export function MobileTabBar() {
  const { pathname } = useLocation()
  const chartExercises = useAuthStore((state) => state.user?.can_use_chart_exercises ?? false)

  return (
    <>
      <div aria-hidden="true" className="h-[calc(3.75rem+env(safe-area-inset-bottom))] bg-primary-dark md:hidden" />
      <nav
        aria-label="Hauptnavigation mobil"
        className="fixed inset-x-0 bottom-0 z-(--z-header) flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {mainNavItems(chartExercises).map((item) => {
          const active = isActive(item, pathname)
          const Icon = ICONS[item.icon]
          return (
            <Link
              key={item.label}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={tabBarItemClass(active)}
            >
              <Icon className="size-6" />
              {item.label}
            </Link>
          )
        })}
        <AccountMenu placement="tabbar" />
      </nav>
    </>
  )
}
