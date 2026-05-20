import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
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
  return (
    <div className="layout-root">
      <Sidebar role={user?.role} />

      <div className="layout-main">
        <header className="layout-header">
          <div className="layout-user-info">
            <span className="layout-user-name">
              {user?.prenom && user?.nom
                ? `${user.prenom} ${user.nom}`
                : `Matricule : ${user?.matricule}`}
            </span>
            <span className="layout-date">
              {new Date().toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <button className="layout-change-pwd-btn" onClick={() => setShowChangePwd(true)}>
              Mot de passe
            </button>
            <button className="layout-logout-btn" onClick={handleLogout}>
              Déconnexion
            </button>
          </div>
        </header>

        <main className="layout-content">
          <Outlet />
        </main>
      </div>

      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
    </div>
  )
}
