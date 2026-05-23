/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react'
import Modal from '../ui/Modal/Modal'
import FormField from '../ui/FormField/FormField'
import api from '../../api'

const EMPTY_FORM = {
  plan_formation_id: '',
  intitule: '',
  type: 'interne',
  organisme: '',
  date_debut: '',
  date_fin: '',
  lieu: '',
  budget_prevu: '',
  niveau: '',
}

const fieldValue = (value) => value ?? ''

export default function FormationFormModal({ isOpen, onClose, onSaved, formation, plans = [] }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!isOpen) return
    setForm({
      plan_formation_id: fieldValue(formation?.plan_formation_id),
      intitule: fieldValue(formation?.intitule),
      type: formation?.type ?? 'interne',
      organisme: fieldValue(formation?.organisme),
      date_debut: formation?.date_debut?.slice(0, 10) ?? '',
      date_fin: formation?.date_fin?.slice(0, 10) ?? '',
      lieu: fieldValue(formation?.lieu),
      budget_prevu: fieldValue(formation?.budget_prevu ?? formation?.cout),
      niveau: fieldValue(formation?.niveau),
    })
    setErrors({})
  }, [formation, isOpen])

  if (!isOpen) return null

  const onChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: null, general: null }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})

    const budget = form.budget_prevu === '' ? null : Number(form.budget_prevu)
    const payload = {
      ...form,
      plan_formation_id: form.plan_formation_id || null,
      organisme: form.organisme || null,
      lieu: form.lieu || null,
      niveau: form.niveau || null,
      budget_prevu: budget,
      cout: budget,
    }

    try {
      const request = formation?.id
        ? api.put(`/formations/${formation.id}`, payload)
        : api.post('/formations', payload)
      const { data } = await request
      onSaved?.(data)
      onClose()
    } catch (err) {
      if (err.response?.status === 422 && err.response?.data?.errors) {
        const nextErrors = {}
        for (const [key, messages] of Object.entries(err.response.data.errors)) {
          nextErrors[key] = Array.isArray(messages) ? messages[0] : messages
        }
        setErrors(nextErrors)
      } else {
        setErrors({ general: 'Impossible de sauvegarder la formation.' })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={formation ? 'Modifier la formation' : 'Creer une formation'}
      size="lg"
    >
      <form className="formation-modal-form" onSubmit={submit}>
        <div className="formation-modal-grid">
          <FormField
            label="Plan annuel"
            name="plan_formation_id"
            type="select"
            value={form.plan_formation_id}
            onChange={onChange}
            options={plans.map((plan) => ({
              value: String(plan.id),
              label: `${plan.titre ?? 'Plan'} - ${plan.annee ?? ''}`,
            }))}
          />
          <FormField
            label="Intitule"
            name="intitule"
            value={form.intitule}
            onChange={onChange}
            error={errors.intitule}
            required
          />
          <FormField
            label="Type"
            name="type"
            type="select"
            value={form.type}
            onChange={onChange}
            error={errors.type}
            required
            options={[
              { value: 'interne', label: 'Interne' },
              { value: 'externe', label: 'Externe' },
            ]}
          />
          <FormField
            label="Organisme"
            name="organisme"
            value={form.organisme}
            onChange={onChange}
            error={errors.organisme}
          />
          <FormField
            label="Date debut"
            name="date_debut"
            type="date"
            value={form.date_debut}
            onChange={onChange}
            error={errors.date_debut}
            required
          />
          <FormField
            label="Date fin"
            name="date_fin"
            type="date"
            value={form.date_fin}
            onChange={onChange}
            error={errors.date_fin}
            required
          />
          <FormField
            label="Lieu"
            name="lieu"
            value={form.lieu}
            onChange={onChange}
            error={errors.lieu}
          />
          <FormField
            label="Budget prevu"
            name="budget_prevu"
            type="number"
            value={form.budget_prevu}
            onChange={onChange}
            error={errors.budget_prevu ?? errors.cout}
          />
          <FormField
            label="Niveau"
            name="niveau"
            type="select"
            value={form.niveau}
            onChange={onChange}
            error={errors.niveau}
            options={[
              { value: 'initiation', label: 'Initiation' },
              { value: 'intermediaire', label: 'Intermediaire' },
              { value: 'avance', label: 'Avance' },
              { value: 'expert', label: 'Expert' },
            ]}
          />
        </div>

        {errors.general && <div className="formation-form-error">{errors.general}</div>}

        <div className="formation-modal-actions">
          <button type="button" className="formation-btn-secondary" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button type="submit" className="formation-btn-primary" disabled={saving}>
            {saving ? 'Sauvegarde...' : formation ? 'Mettre a jour' : 'Creer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
