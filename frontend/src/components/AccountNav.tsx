import { Link, useNavigate } from 'react-router-dom'

import { FEEDBACK_MAILTO } from '../contact'
import { useAuthStore } from '../store/authStore'
import { HEADER_LINK } from './Header'

// Header nav for logged-in pages: Profil, Admin (admins only), Abmelden.
export function AccountNav() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  return (
    <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <Link to="/profile" className={HEADER_LINK}>
        Profil
      </Link>
      {user?.is_admin ? (
        <Link to="/admin" className={HEADER_LINK}>
          Admin
        </Link>
      ) : null}
      <a href={FEEDBACK_MAILTO} className={HEADER_LINK}>
        Feedback
      </a>
      <button type="button" onClick={handleLogout} className={HEADER_LINK}>
        Abmelden
      </button>
    </nav>
  )
}
