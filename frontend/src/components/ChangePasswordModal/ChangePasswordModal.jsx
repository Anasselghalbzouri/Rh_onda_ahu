import { useState } from 'react'
import api from '../../api'
import './ChangePasswordModal.css'

export default function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({
    current_password: '',
    password: '',
    password_confirmation: '',
  })
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
    setErrors({ ...errors, [e.target.name]: null })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setErrors({})
    try {
      await api.put('/change-password', form)
      setSuccess(true)
      setTimeout(onClose, 1500)
    } catch (err) {
      if (err.response?.status === 422) {
        const raw = err.response.data.errors || {}
        const flat = {}
        for (const [key, msgs] of Object.entries(raw)) {
          flat[key] = Array.isArray(msgs) ? msgs[0] : msgs
        }
        setErrors(flat)
      } else {
        setErrors({ general: 'Une erreur est survenue.' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="cpwd-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cpwd-modal">
        <div className="cpwd-header">
          <h2 className="cpwd-title">Changer le mot de passe</h2>
          <button className="cpwd-close-btn" onClick={onClose}>✕</button>
        </div>

        {success ? (
          <div className="cpwd-success-box">Mot de passe mis à jour avec succès !</div>
        ) : (
          <form onSubmit={handleSubmit}>
            {errors.general && <div className="cpwd-error-box">{errors.general}</div>}

            <Field
              label="Mot de passe actuel"
              name="current_password"
              value={form.current_password}
              show={showCurrent}
              onToggle={() => setShowCurrent(!showCurrent)}
              onChange={handleChange}
              error={errors.current_password}
            />
            <Field
              label="Nouveau mot de passe"
              name="password"
              value={form.password}
              show={showNew}
              onToggle={() => setShowNew(!showNew)}
              onChange={handleChange}
              error={errors.password}
            />
            <Field
              label="Confirmer le nouveau mot de passe"
              name="password_confirmation"
              value={form.password_confirmation}
              show={showConfirm}
              onToggle={() => setShowConfirm(!showConfirm)}
              onChange={handleChange}
              error={errors.password_confirmation}
            />

            <div className="cpwd-actions">
              <button type="button" className="cpwd-cancel-btn" onClick={onClose}>
                Annuler
              </button>
              <button type="submit" className="cpwd-submit-btn" disabled={loading}>
                {loading ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function Field({ label, name, value, show, onToggle, onChange, error }) {
  return (
    <div className="cpwd-field">
      <label className="cpwd-label">{label}</label>
      <div className="cpwd-input-wrap">
        <input
          type={show ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={onChange}
          required
          className={`cpwd-input${error ? ' has-error' : ''}`}
        />
        <button type="button" className="cpwd-eye-btn" onClick={onToggle}>
          {show ? '🙈' : '👁️'}
        </button>
      </div>
      {error && <span className="cpwd-error-text">{error}</span>}
    </div>
  )
}
