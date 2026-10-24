import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { getDisplayName } from '../format'
import { useAuthStore } from '../store/authStore'
import { HEADER_MENU_BUTTON, tabBarItemClass } from './headerLink'
import { AccountIcon } from './icons'
import { useNavigateWhileMounted } from '../hooks/useNavigateWhileMounted'

const ITEM = 'block w-full px-4 py-2 text-left text-sm text-ink hover:bg-surface-alt'

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`size-4 self-center transition-transform ${isOpen ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Where the menu sits: at the end of the header (wide screens; the panel opens below it), or as
// the last tab of the phone tab bar (the panel opens above it).
export type AccountMenuPlacement = 'header' | 'tabbar'

const PANEL = {
  header: 'top-full right-0 mt-2',
  tabbar: 'right-2 bottom-full mb-2',
}

// The "Konto" menu of the logged-in navigation: the learner's own things only (the site's `links`,
// then Abmelden); the content pages and Feedback sit in the footer. A disclosure
// (button + list of links), not an ARIA menu — it's site navigation. Closes on Escape, a click
// outside, choosing an entry, and any route change: the open state remembers the path it was
// opened on, so navigating away closes it without an effect.
// One entry of the menu's list: each site has its own (SKS Lotse's Lernstand and Admin, SBF Lotse's
// Läufe). `reloadDocument` loads the target as a new page instead of in the app.
export interface AccountMenuLink {
  to: string
  label: string
  reloadDocument?: boolean
}

export function AccountMenu({
  links,
  placement = 'header',
}: {
  links: readonly AccountMenuLink[]
  placement?: AccountMenuPlacement
}) {
  const menuId = placement === 'header' ? 'account-menu' : 'account-menu-tabbar'
  const { pathname } = useLocation()
  const navigate = useNavigateWhileMounted()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const [openOn, setOpenOn] = useState<string | null>(null)
  const isOpen = openOn === pathname
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpenOn(null)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpenOn(null)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  function close() {
    setOpenOn(null)
  }

  async function handleLogout() {
    close()
    await logout()
    navigate('/')
  }

  return (
    <div ref={containerRef} className={placement === 'header' ? 'relative' : 'flex flex-1'}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setOpenOn(isOpen ? null : pathname)}
        className={placement === 'header' ? HEADER_MENU_BUTTON : tabBarItemClass(isOpen)}
      >
        {placement === 'header' ? (
          <>
            Konto
            <ChevronIcon isOpen={isOpen} />
          </>
        ) : (
          <>
            <AccountIcon className="size-6" />
            Konto
          </>
        )}
      </button>
      {isOpen ? (
        <div
          id={menuId}
          className={`absolute z-(--z-popover) min-w-56 rounded-tile border border-ink bg-surface py-1 text-left shadow-lg ${PANEL[placement]}`}
        >
          {user ? (
            <p className="border-b border-border px-4 pt-2 pb-3 text-xs text-ink-soft">
              Angemeldet als <span className="block font-mono break-all text-ink">{getDisplayName(user)}</span>
            </p>
          ) : null}
          <ul className="border-b border-border py-1">
            {links.map((link) => (
              <li key={link.to}>
                <Link to={link.to} reloadDocument={link.reloadDocument} className={ITEM} onClick={close}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="py-1">
            <button type="button" onClick={handleLogout} className={ITEM}>
              Abmelden
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
