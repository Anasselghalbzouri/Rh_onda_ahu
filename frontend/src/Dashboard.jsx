import { useState } from 'react'
import ListeEmployes from './ListeEmployes'
import FicheEmploye from './FicheEmploye'
import ChangePasswordModal from './ChangePasswordModal'

const TABS = [
  { key: 'employes', label: 'Employés' },
]

export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('employes')
  const [selectedEmployeId, setSelectedEmployeId] = useState(null)
  const [showChangePwd, setShowChangePwd] = useState(false)

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>RH — ONDA</h1>
        <div style={styles.userInfo}>
          <span style={styles.userNameBadge}>
            {user.prenom && user.nom ? `${user.prenom} ${user.nom}` : `Matricule : ${user.matricule}`}
          </span>
          <span style={styles.dateBadge}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          {/* <button style={styles.changePwdBtn} onClick={() => setShowChangePwd(true)}>
            Mot de passe
          </button> */}
          <button style={styles.logoutBtn} onClick={onLogout}>
            Déconnexion
          </button>
        </div>
      </div>

      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}

      {!selectedEmployeId && (
        <div style={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              style={{ ...styles.tab, ...(activeTab === tab.key ? styles.tabActive : {}) }}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div style={styles.content}>
        {selectedEmployeId ? (
          <FicheEmploye id={selectedEmployeId} onRetour={() => setSelectedEmployeId(null)} />
        ) : (
          activeTab === 'employes' && <ListeEmployes onSelectEmploye={setSelectedEmployeId} />
        )}
      </div>
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', background: '#f0f4f8' },
  header: {
    background: '#1a3c5e',
    color: '#fff',
    padding: '1rem 2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { margin: 0, fontSize: '1.3rem', fontWeight: 700 },
  userInfo: { display: 'flex', alignItems: 'center', gap: '1rem' },
  badge: {
    background: 'rgba(255,255,255,0.15)',
    padding: '0.3rem 0.8rem',
    borderRadius: '20px',
    fontSize: '0.875rem',
  },
  userNameBadge: {
    background: 'rgba(255,255,255,0.15)',
    padding: '0.3rem 0.9rem',
    borderRadius: '20px',
    fontSize: '0.875rem',
    fontWeight: 700,
  },
  dateBadge: {
    background: 'rgba(255,255,255,0.10)',
    padding: '0.3rem 0.9rem',
    borderRadius: '20px',
    fontSize: '0.8rem',
    color: 'rgba(255,255,255,0.85)',
  },
  changePwdBtn: {
    background: 'rgba(255,255,255,0.15)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.35)',
    padding: '0.4rem 1rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.875rem',
  },
  logoutBtn: {
    background: '#dc2626',
    color: '#fff',
    border: 'none',
    padding: '0.4rem 1rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.875rem',
  },
  tabs: {
    display: 'flex',
    gap: '0.5rem',
    padding: '0.8rem 2rem 0',
    background: '#1a3c5e',
  },
  tab: {
    padding: '0.5rem 1.2rem',
    border: 'none',
    borderRadius: '6px 6px 0 0',
    background: 'rgba(255,255,255,0.15)',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.9rem',
  },
  tabActive: {
    background: '#f0f4f8',
    color: '#1a3c5e',
  },
  content: { padding: '1.5rem' },
}
