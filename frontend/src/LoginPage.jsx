import { useState } from 'react'

export default function LoginPage({ onLogin }) {
  const [matricule, setMatricule] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const canSubmit = matricule.trim().length > 0 && password.length > 0 && !loading

  const clearError = () => {
    if (error) {
      setError('')
    }
  }

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
      <style>{loginStyles}</style>

      <section className="login-shell" aria-label="Connexion">
        <div className="login-card">
          <div className="login-heading">
            <p>Connexion</p>
            <h2>Bienvenue</h2>
          </div>

          <form onSubmit={handleSubmit} className="login-form" noValidate>
            <div className="form-field">
              <label htmlFor="matricule">Matricule</label>
              <input
                id="matricule"
                type="text"
                value={matricule}
                onChange={(e) => {
                  setMatricule(e.target.value)
                  clearError()
                }}
                placeholder="Ex : 9519"
                autoComplete="username"
                required
                autoFocus
              />
            </div>

            <div className="form-field">
              <label htmlFor="password">Mot de passe</label>
              <div className="password-field">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    clearError()
                  }}
                  placeholder="Votre mot de passe"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? 'Masquer' : 'Afficher'}
                </button>
              </div>
            </div>

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}

            <button className="submit-button" type="submit" disabled={!canSubmit} aria-busy={loading}>
              {loading ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Connexion...
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

const loginStyles = `
  .login-page {
    --ink: #13201f;
    --muted: #657371;
    --line: #d7e0dd;
    --panel: #ffffff;
    --surface: #f4f8f6;
    --teal: #0f766e;
    --teal-dark: #115e59;
    --sky: #0369a1;
    --amber: #f59e0b;
    --danger: #b42318;
    --danger-bg: #fff1f0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ink);
    font-family: "Aptos Display", "Segoe UI", sans-serif;
    background:
      linear-gradient(135deg, rgba(15, 118, 110, 0.08), transparent 34%),
      linear-gradient(160deg, #f6faf8 0%, #eaf4f2 52%, #eef6fb 100%);
  }

  .login-shell {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .login-card {
    width: min(100%, 420px);
    border: 1px solid rgba(19, 32, 31, 0.1);
    border-radius: 8px;
    background: var(--panel);
    box-shadow: 0 24px 70px rgba(19, 32, 31, 0.14);
    padding: 2rem;
  }

  .login-heading p {
    margin: 0;
    color: var(--teal);
    font-size: 0.8rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  .login-heading h2 {
    margin: 0.35rem 0 1.5rem;
    font-size: 2rem;
    line-height: 1.15;
  }

  .login-form {
    display: grid;
    gap: 1rem;
  }

  .form-field {
    display: grid;
    gap: 0.45rem;
  }

  .form-field label {
    color: #344541;
    font-size: 0.9rem;
    font-weight: 700;
  }

  .form-field input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    padding: 0.9rem 0.95rem;
    outline: none;
    transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
  }

  .form-field input:focus {
    border-color: var(--teal);
    background: #ffffff;
    box-shadow: 0 0 0 4px rgba(15, 118, 110, 0.14);
  }

  .password-field {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.5rem;
  }

  .ghost-button {
    min-height: 48px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: #ffffff;
    color: var(--teal-dark);
    cursor: pointer;
    font: inherit;
    font-weight: 700;
    padding: 0 0.85rem;
  }

  .ghost-button:focus-visible,
  .submit-button:focus-visible {
    outline: 3px solid rgba(245, 158, 11, 0.34);
    outline-offset: 3px;
  }

  .login-error {
    margin: 0;
    border: 1px solid #ffd0cc;
    border-radius: 8px;
    background: var(--danger-bg);
    color: var(--danger);
    font-size: 0.9rem;
    line-height: 1.45;
    padding: 0.75rem 0.85rem;
  }

  .submit-button {
    display: inline-flex;
    min-height: 50px;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    border: 0;
    border-radius: 8px;
    background: linear-gradient(135deg, var(--teal), var(--sky));
    color: #ffffff;
    cursor: pointer;
    font: inherit;
    font-weight: 800;
    padding: 0.9rem 1rem;
    transition: transform 160ms ease, opacity 160ms ease, box-shadow 160ms ease;
  }

  .submit-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 12px 28px rgba(3, 105, 161, 0.22);
  }

  .submit-button:disabled {
    cursor: not-allowed;
    opacity: 0.62;
  }

  .spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(255, 255, 255, 0.42);
    border-top-color: #ffffff;
    border-radius: 999px;
    animation: login-spin 700ms linear infinite;
  }

  @keyframes login-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 460px) {
    .login-card {
      padding: 1.4rem;
    }

    .password-field {
      grid-template-columns: 1fr;
    }

    .ghost-button {
      width: 100%;
    }
  }
`
