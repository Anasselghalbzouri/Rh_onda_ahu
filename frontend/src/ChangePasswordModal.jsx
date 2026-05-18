import { useState } from 'react'
import axios from 'axios'
import { useAuth } from './useAuth'

export default function ChangePasswordModal({ onClose }) {
  const { token } = useAuth()
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
      await axios.put(
        `${import.meta.env.VITE_API_URL}/change-password`,
        form,
        { headers: { Authorization: `Bearer ${token}` } }
      )
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
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Changer le mot de passe</h2>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {success ? (
          <div style={styles.successBox}>Mot de passe mis à jour avec succès !</div>
        ) : (
          <form onSubmit={handleSubmit}>
            {errors.general && <div style={styles.errorBox}>{errors.general}</div>}

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

            <div style={styles.actions}>
              <button type="button" style={styles.cancelBtn} onClick={onClose}>
                Annuler
              </button>
              <button type="submit" style={styles.submitBtn} disabled={loading}>
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
    <div style={{ marginBottom: 20 }}>
      <label style={styles.label}>{label}</label>
      <div style={styles.inputWrap}>
        <input
          type={show ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={onChange}
          required
          style={{ ...styles.input, borderColor: error ? '#dc2626' : '#d1d5db' }}
        />
        <button type="button" style={styles.eyeBtn} onClick={onToggle}>
          {show ? '🙈' : '👁️'}
        </button>
      </div>
      {error && <span style={styles.errorText}>{error}</span>}
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#fff',
    borderRadius: 12,
    padding: '32px 36px',
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 24,
  },
  modalTitle: { margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1a3c5e' },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 18,
    cursor: 'pointer', color: '#6b7280', lineHeight: 1,
  },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
  inputWrap: { position: 'relative' },
  input: {
    width: '100%', padding: '9px 40px 9px 12px', borderRadius: 8,
    border: '1.5px solid #d1d5db', fontSize: 14, outline: 'none',
    boxSizing: 'border-box',
  },
  eyeBtn: {
    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer', fontSize: 16,
  },
  errorText: { fontSize: 12, color: '#dc2626', marginTop: 4, display: 'block' },
  errorBox: {
    background: '#fef2f2', border: '1px solid #fca5a5',
    borderRadius: 8, padding: '10px 14px', color: '#dc2626',
    fontSize: 13, marginBottom: 16,
  },
  successBox: {
    background: '#f0fdf4', border: '1px solid #86efac',
    borderRadius: 8, padding: '16px 14px', color: '#16a34a',
    fontSize: 14, textAlign: 'center', fontWeight: 600,
  },
  actions: { display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 },
  cancelBtn: {
    padding: '9px 20px', borderRadius: 8, border: '1.5px solid #d1d5db',
    background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 600, fontSize: 14,
  },
  submitBtn: {
    padding: '9px 20px', borderRadius: 8, border: 'none',
    background: '#1d4ed8', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14,
  },
}
