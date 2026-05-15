import { useState } from 'react'
import ListeEmployes from './ListeEmployes'

const TABS = [
  { key: 'employes', label: 'Employés' },
]

export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('employes')

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>RH — ONDA</h1>
        <div style={styles.userInfo}>
          <span style={styles.badge}>Matricule : {user.matricule}</span>
          <button style={styles.logoutBtn} onClick={onLogout}>
            Déconnexion
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            style={{
              ...styles.tab,
              ...(activeTab === tab.key ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {activeTab === 'employes' && <ListeEmployes />}
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
