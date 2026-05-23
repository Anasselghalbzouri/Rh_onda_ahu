/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react'
import Modal from '../ui/Modal/Modal'
import api from '../../api'
import './EvaluationFormationModal.css'

const today = () => new Date().toISOString().slice(0, 10)

const initialForm = {
  type: 'chaud',
  note: 14,
  commentaire: '',
  efficace: true,
}

export default function EvaluationFormationModal({
  isOpen,
  onClose,
  onSaved,
  formation,
  employeId,
  evaluation,
}) {
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    setForm({
      type: evaluation?.type ?? 'chaud',
      note: Number(evaluation?.note ?? 14),
      commentaire: evaluation?.commentaire ?? '',
      efficace: evaluation?.efficace ?? true,
    })
    setError(null)
  }, [evaluation, isOpen])

  if (!isOpen || !formation) return null

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError(null)

    const payload = {
      employe_id: employeId,
      type: form.type,
      note: Number(form.note),
      commentaire: form.commentaire,
      efficace: Boolean(form.efficace),
      date_eval: today(),
    }

    try {
      const request = evaluation?.id
        ? api.put(`/evaluations/${evaluation.id}`, payload)
        : api.post(`/formations/${formation.id}/evaluations`, payload)
      const { data } = await request
      onSaved?.(data)
      onClose()
    } catch (err) {
      const messages = err.response?.data?.errors
      setError(messages ? Object.values(messages).flat().join(' - ') : "Impossible d'enregistrer l'evaluation.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Evaluation formation" size="md">
      <form className="eval-form" onSubmit={submit}>
        <div className="eval-context">
          <span>Formation</span>
          <strong>{formation.intitule ?? 'Formation'}</strong>
        </div>

        <fieldset className="eval-radio-group">
          <legend>Type d'evaluation</legend>
          <label>
            <input
              type="radio"
              name="type"
              value="chaud"
              checked={form.type === 'chaud'}
              onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
            />
            A chaud
          </label>
          <label>
            <input
              type="radio"
              name="type"
              value="froid"
              checked={form.type === 'froid'}
              onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
            />
            A froid
          </label>
        </fieldset>

        <label className="eval-slider">
          <span>Note</span>
          <strong>{form.note}/20</strong>
          <input
            type="range"
            min="0"
            max="20"
            value={form.note}
            onChange={(event) => setForm((prev) => ({ ...prev, note: Number(event.target.value) }))}
          />
        </label>

        <label className="eval-field">
          <span>Commentaire</span>
          <textarea
            rows={4}
            value={form.commentaire}
            onChange={(event) => setForm((prev) => ({ ...prev, commentaire: event.target.value }))}
            placeholder="Synthese de l'evaluation..."
          />
        </label>

        <label className="eval-toggle">
          <input
            type="checkbox"
            checked={form.efficace}
            onChange={(event) => setForm((prev) => ({ ...prev, efficace: event.target.checked }))}
          />
          <span>Formation jugee efficace</span>
        </label>

        {error && <div className="eval-error">{error}</div>}

        <div className="eval-actions">
          <button type="button" className="eval-btn-secondary" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button type="submit" className="eval-btn-primary" disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
