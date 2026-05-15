import { useState } from 'react'

export default function LoginPage({ onLogin }) {
  const [matricule, setMatricule] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await onLogin(matricule, password)
    } catch (err) {
      const msg =
        err.response?.data?.errors?.matricule?.[0] ||
        err.response?.data?.message ||
        'Impossible de vous connecter pour le moment.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.formPanel}>
        <div style={styles.card}>
          <p style={styles.badge}>Dossi RH</p>
          <h2 style={styles.cardTitle}>Connexion</h2>
          <p style={styles.cardSubtitle}>Renseignez vos identifiants pour continuer.</p>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label htmlFor="matricule" style={styles.label}>
                Matricule
              </label>
              <input
                id="matricule"
                style={styles.input}
                type="text"
                value={matricule}
                onChange={(e) => setMatricule(e.target.value)}
                placeholder="Ex : 9519"
                required
                autoFocus
              />
            </div>

            <div style={styles.field}>
              <label htmlFor="password" style={styles.label}>
                Mot de passe
              </label>
              <input
                id="password"
                style={styles.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                required
              />
            </div>

            {error && <p style={styles.error}>{error}</p>}

            <button style={{ ...styles.button, ...(loading ? styles.buttonLoading : {}) }} type="submit" disabled={loading}>
              {loading ? 'Connexion en cours...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at top, rgba(14, 165, 233, 0.18), transparent 28%), linear-gradient(180deg, #f8fafc 0%, #eef6ff 100%)',
  },
  formPanel: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1.25rem',
  },
  card: {
    width: '100%',
    maxWidth: '430px',
    background: 'rgba(255, 255, 255, 0.96)',
    borderRadius: '24px',
    padding: '2.2rem',
    border: '1px solid rgba(148, 163, 184, 0.22)',
    boxShadow: '0 30px 70px -36px rgba(15, 23, 42, 0.35)',
    backdropFilter: 'blur(10px)',
  },
  badge: {
    margin: 0,
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#0f766e',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  cardTitle: {
    margin: '0.65rem 0 0 0',
    fontSize: '1.95rem',
    color: '#0f172a',
  },
  cardSubtitle: {
    margin: '0.35rem 0 1.7rem 0',
    color: '#64748b',
    fontSize: '0.95rem',
  },
  form: {
    display: 'grid',
    gap: '1rem',
  },
  field: {
    display: 'grid',
    gap: '0.45rem',
  },
  label: {
    fontWeight: 600,
    color: '#334155',
    fontSize: '0.88rem',
  },
  input: {
    border: '1px solid #cbd5e1',
    borderRadius: '14px',
    padding: '0.85rem 0.95rem',
    fontSize: '1rem',
    color: '#0f172a',
    background: '#f8fafc',
    outline: 'none',
  },
  error: {
    margin: 0,
    borderRadius: '14px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    fontSize: '0.9rem',
    padding: '0.7rem 0.8rem',
  },
  button: {
    marginTop: '0.4rem',
    border: 'none',
    borderRadius: '14px',
    padding: '0.9rem 1rem',
    background: 'linear-gradient(135deg, #0f766e, #0284c7)',
    color: '#ffffff',
    fontWeight: 700,
    fontSize: '0.97rem',
    cursor: 'pointer',
  },
  buttonLoading: {
    opacity: 0.85,
    cursor: 'not-allowed',
  },
}
