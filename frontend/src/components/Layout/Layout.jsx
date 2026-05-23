/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Bell, CalendarDays, KeyRound, LogOut, Search, ArrowRight } from 'lucide-react'
import api from '../../api'
import Sidebar from '../Sidebar/Sidebar'
import ChangePasswordModal from '../ChangePasswordModal/ChangePasswordModal'
import './Layout.css'

export default function Layout({ user, onLogout }) {
  const navigate = useNavigate()
  const [showChangePwd, setShowChangePwd] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const notifRef = useRef(null)

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
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    let cancelled = false
    api.get('/dashboard/stats')
      .then(({ data }) => {
        if (cancelled) return
        const items = []
        if ((data.conges_en_cours ?? 0) > 0) {
          items.push({ label: 'Congés en cours', value: data.conges_en_cours, path: '/conges' })
        }
        if ((data.solde_moyen ?? 0) < 10) {
          items.push({ label: 'Solde moyen faible', value: `${data.solde_moyen}j`, path: '/dashboard' })
        }
        if ((data.total_employes ?? 0) > 0) {
          items.push({ label: 'Dossiers personnel', value: data.total_employes, path: '/personnel' })
        }
        setNotifications(items.slice(0, 3))
      })
      .catch(() => setNotifications([]))
    return () => { cancelled = true }
  }, [])

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

            <div className="layout-notif-wrap" ref={notifRef}>
              <button
                className="layout-notification-btn"
                type="button"
                aria-label={`${notifications.length} notifications RH`}
                aria-expanded={showNotifications}
                onClick={() => setShowNotifications((v) => !v)}
              >
                <Bell size={15} aria-hidden="true" />
                {notifications.length > 0 && <span>{notifications.length}</span>}
              </button>

              {showNotifications && (
                <div className="layout-notif-panel" role="menu" aria-label="Notifications">
                  <div className="layout-notif-header">
                    <span>Notifications</span>
                    {notifications.length > 0 && (
                      <span className="layout-notif-count">{notifications.length}</span>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="layout-notif-empty">Aucune notification</div>
                  ) : (
                    <ul className="layout-notif-list">
                      {notifications.map((n, i) => (
                        <li key={i}>
                          <button
                            type="button"
                            onClick={() => { navigate(n.path); setShowNotifications(false) }}
                          >
                            <span className="layout-notif-dot" />
                            <span className="layout-notif-text">
                              <strong>{n.label}</strong>
                              <small>{n.value}</small>
                            </span>
                            <ArrowRight size={13} aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <span className="layout-date">
              <CalendarDays size={14} aria-hidden="true" />
              {dateLabel}
            </span>

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
