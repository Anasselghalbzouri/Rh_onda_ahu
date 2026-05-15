export default function Dashboard({ user, onLogout }) {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Tableau de bord RH</h1>
        <div style={styles.userInfo}>
          <span style={styles.badge}>Matricule : {user.matricule}</span>
          <button style={styles.logoutBtn} onClick={onLogout}>
            Déconnexion
          </button>
        </div>
      </div>

      <div style={styles.content}>
        <p style={styles.welcome}>Bienvenue, Responsable RH</p>
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
  content: { padding: '2rem' },
  welcome: { fontSize: '1.1rem', color: '#374151' },
}
