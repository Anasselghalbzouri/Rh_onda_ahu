import { useState } from 'react'

export default function LoginPage({ onLogin }) {
  const [matricule, setMatricule] = useState('')
  const [password, setPassword]   = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onLogin(matricule, password)
    } catch (err) {
      const msg = err.response?.data?.errors?.matricule?.[0]
        || err.response?.data?.message
        || 'Erreur de connexion.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>RH — ONDA</h1>
        <p style={styles.subtitle}>Espace Responsable RH</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Matricule</label>
            <input
              style={styles.input}
              type="text"
              value={matricule}
              onChange={(e) => setMatricule(e.target.value)}
              placeholder="Ex: 9519"
              required
              autoFocus
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Mot de passe</label>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f0f4f8',
  },
  card: {
    background: '#fff',
    padding: '2.5rem',
    borderRadius: '12px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
    width: '100%',
    maxWidth: '380px',
  },
  title: {
    margin: 0,
    fontSize: '1.8rem',
    fontWeight: 700,
    color: '#1a3c5e',
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: '0.3rem',
    marginBottom: '2rem',
    fontSize: '0.95rem',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '1.2rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  label: { fontSize: '0.875rem', fontWeight: 600, color: '#374151' },
  input: {
    padding: '0.65rem 0.9rem',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '1rem',
    outline: 'none',
  },
  error: {
    color: '#dc2626',
    fontSize: '0.875rem',
    margin: 0,
    textAlign: 'center',
  },
  button: {
    marginTop: '0.5rem',
    padding: '0.75rem',
    background: '#1a3c5e',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
}
