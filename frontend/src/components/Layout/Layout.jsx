import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { CalendarDays, KeyRound, LogOut, Search, ArrowRight } from 'lucide-react'
import api from '../../api'
import Sidebar from '../Sidebar/Sidebar'
import NotificationBell from '../NotificationBell/NotificationBell'
import ChangePasswordModal from '../ChangePasswordModal/ChangePasswordModal'
import './Layout.css'

export default function Layout({ user, onLogout }) {
  const navigate = useNavigate()
  const [showChangePwd, setShowChangePwd] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  const handleLogout = async () => {
    await onLogout()
    navigate('/login', { replace: true })
  }

  const dateLabel = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  useEffect(() => {
    const value = query.trim()
    if (value.length < 2) {
      setResults([])
      setSearching(false)
      return
    }

    const timer = setTimeout(() => {
      setSearching(true)
      api.get('/employes', { params: { search: value } })
        .then(({ data }) => setResults((data.data ?? []).slice(0, 6)))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 220)

    return () => clearTimeout(timer)
  }, [query])

  const openEmployee = (id) => {
    navigate('/personnel', { state: { selectedEmployeId: id } })
    setQuery('')
    setResults([])
  }

  return (
    <div className="layout-root">
      <div className="layout-shell">
        <Sidebar role={user?.role} />

        <div className="layout-main">
          <header className="layout-header">
            <div className="layout-search">
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher employé, matricule, fonction..."
                aria-label="Recherche globale"
              />
              {(query.trim().length >= 2 || results.length > 0) && (
                <div className="layout-search-results">
                  {searching ? (
                    <div className="layout-search-empty">Recherche...</div>
                  ) : results.length === 0 ? (
                    <div className="layout-search-empty">Aucun résultat</div>
                  ) : (
                    results.map((emp) => (
                      <button key={emp.id} type="button" onClick={() => openEmployee(emp.id)}>
                        <span className="layout-search-avatar">{`${emp.prenom?.[0] ?? ''}${emp.nom?.[0] ?? ''}`}</span>
                        <span>
                          <strong>{emp.prenom} {emp.nom}</strong>
                          <small>{emp.matricule} · {emp.fonction ?? 'Fonction non renseignée'}</small>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <span className="layout-date">
              <CalendarDays size={14} aria-hidden="true" />
              {dateLabel}
            </span>

            <NotificationBell />

            <span className="layout-user-name">
              {user?.prenom && user?.nom
                ? `${user.prenom} ${user.nom}`
                : `Matricule : ${user?.matricule}`}
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
