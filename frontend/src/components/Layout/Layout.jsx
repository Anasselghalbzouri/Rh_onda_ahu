import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { LogOut, KeyRound, CalendarDays } from 'lucide-react'
import Sidebar from '../Sidebar/Sidebar'
import ChangePasswordModal from '../ChangePasswordModal/ChangePasswordModal'
import './Layout.css'

export default function Layout({ user, onLogout }) {
  const navigate = useNavigate()
  const [showChangePwd, setShowChangePwd] = useState(false)

  const handleLogout = async () => {
    await onLogout()
    navigate('/login', { replace: true })
  }

  const dateLabel = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="layout-root">
      <div className="layout-shell">
        <Sidebar role={user?.role} />

        <div className="layout-main">
          <header className="layout-header">
            <span className="layout-user-name">
              {user?.prenom && user?.nom
                ? `${user.prenom} ${user.nom}`
                : `Matricule : ${user?.matricule}`}
            </span>

            <span className="layout-date">
              <CalendarDays size={14} aria-hidden="true" />
              {dateLabel}
            </span>

            <button
              className="layout-header-btn"
              onClick={() => setShowChangePwd(true)}
              aria-label="Changer le mot de passe"
            >
              <KeyRound size={14} aria-hidden="true" />
              Mot de passe
            </button>

            <button
              className="layout-logout-btn"
              onClick={handleLogout}
              aria-label="Se déconnecter"
            >
              <LogOut size={14} aria-hidden="true" />
              Déconnexion
            </button>
          </header>

          <main className="layout-content">
            <Outlet />
          </main>
        </div>
      </div>

      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
    </div>
  )
}
