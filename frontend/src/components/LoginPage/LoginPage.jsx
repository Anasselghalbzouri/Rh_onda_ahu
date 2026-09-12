import { useState } from 'react'
import './LoginPage.css'

export default function LoginPage({ onLogin }) {
  const [matricule, setMatricule] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const canSubmit = matricule.trim().length > 0 && password.length > 0 && !loading

  const clearError = () => { if (error) setError('') }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!matricule.trim() || !password) {
      setError('Veuillez saisir votre matricule et votre mot de passe.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await onLogin(matricule.trim(), password)
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
    <main className="login-page">
      <section className="login-shell" aria-label="Connexion">
        <div className="login-card">
          <div className="login-heading">
            <h2>Connexion</h2>
          </div>

          <form onSubmit={handleSubmit} className="login-form" noValidate>
            <div className="form-field">
              <label htmlFor="matricule">Matricule</label>
              <input
                id="matricule"
                type="text"
                value={matricule}
                onChange={(e) => { setMatricule(e.target.value); clearError() }}
                placeholder="   "
                autoComplete="username"
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="password">Mot de passe</label>
              <div className="password-field">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError() }}
                  placeholder="Votre mot de passe"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? 'Masquer' : 'Afficher'}
                </button>
              </div>
            </div>

            {error && (
              <p className="login-error" role="alert">{error}</p>
            )}

            <button className="submit-button" type="submit" disabled={!canSubmit} aria-busy={loading}>
              {loading ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Connexion…
                </>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
