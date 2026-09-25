import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { FEEDBACK_MAILTO } from '../contact'
import { getDisplayName } from '../format'
import { useAuthStore } from '../store/authStore'
import { HEADER_MENU_BUTTON } from './headerLink'

const MENU_ID = 'account-menu'
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

// The "Menü" button at the end of the logged-in header: everything that isn't one of the two
// learning destinations (Profil, Admin, the content pages, Feedback, Abmelden). A disclosure
// (button + list of links), not an ARIA menu — it's site navigation. Closes on Escape, a click
// outside, choosing an entry, and any route change: the open state remembers the path it was
// opened on, so navigating away closes it without an effect.
export function AccountMenu() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
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
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={MENU_ID}
        onClick={() => setOpenOn(isOpen ? null : pathname)}
        className={HEADER_MENU_BUTTON}
      >
        Menü
        <ChevronIcon isOpen={isOpen} />
      </button>
      {isOpen ? (
        <div
          id={MENU_ID}
          className="absolute top-full right-0 z-20 mt-2 min-w-56 rounded-tile border border-ink bg-surface py-1 shadow-lg"
        >
          {user ? (
            <p className="border-b border-border px-4 pt-2 pb-3 text-xs text-ink-soft">
              Angemeldet als <span className="block font-mono break-all text-ink">{getDisplayName(user)}</span>
            </p>
          ) : null}
          <ul className="border-b border-border py-1">
            <li>
              <Link to="/profile" className={ITEM} onClick={close}>
                Profil
              </Link>
            </li>
            {user?.is_admin ? (
              <li>
                <Link to="/admin" className={ITEM} onClick={close}>
                  Admin
                </Link>
              </li>
            ) : null}
            <li>
              <Link to="/exam-process" className={ITEM} onClick={close}>
                Prüfungsablauf
              </Link>
            </li>
            <li>
              <Link to="/pricing" className={ITEM} onClick={close}>
                Shop
              </Link>
            </li>
            <li>
              <Link to="/faq" className={ITEM} onClick={close}>
                FAQ
              </Link>
            </li>
            <li>
              <a href={FEEDBACK_MAILTO} className={ITEM} onClick={close}>
                Feedback
              </a>
            </li>
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
