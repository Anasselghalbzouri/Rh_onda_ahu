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
  niveau: '',
}

const fieldValue = (value) => value ?? ''

export default function FormationFormModal({ isOpen, onClose, onSaved, formation, plans = [] }) {
  const [form, setForm]                   = useState(EMPTY_FORM)
  const [saving, setSaving]               = useState(false)
  const [errors, setErrors]               = useState({})

  const [services, setServices]           = useState([])
  const [serviceId, setServiceId]         = useState('')
  const [employes, setEmployes]           = useState([])
  const [loadingEmployes, setLoadingEmployes] = useState(false)
  const [selectedEmployes, setSelectedEmployes] = useState([])

  // Charger les services une seule fois à l'ouverture
  useEffect(() => {
    if (!isOpen) return
    api.get('/services').then(({ data }) => setServices(data)).catch(() => {})
  }, [isOpen])

  // Réinitialiser le formulaire à chaque ouverture
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
      niveau: fieldValue(formation?.niveau),
    })
    setErrors({})
    setServiceId('')
    setEmployes([])
    setSelectedEmployes([])
  }, [formation, isOpen])

  // Charger les employés du service sélectionné
  useEffect(() => {
    if (!serviceId) { setEmployes([]); setSelectedEmployes([]); return }
    setLoadingEmployes(true)
    api.get('/employes', { params: { service_id: serviceId, statut: 'actif', per_page: 200 } })
      .then(({ data }) => setEmployes(data.data ?? []))
      .catch(() => setEmployes([]))
      .finally(() => setLoadingEmployes(false))
  }, [serviceId])

  if (!isOpen) return null

  const onChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: null, general: null }))
  }

  const toggleEmploye = (id) => {
    setSelectedEmployes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const toggleAll = () => {
    setSelectedEmployes((prev) =>
      prev.length === employes.length ? [] : employes.map((e) => e.id)
    )
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})

    const payload = {
      ...form,
      plan_formation_id: form.plan_formation_id || null,
      organisme: form.organisme || null,
      lieu: form.lieu || null,
      niveau: form.niveau || null,
    }

    try {
      const request = formation?.id
        ? api.put(`/formations/${formation.id}`, payload)
        : api.post('/formations', payload)
      const { data } = await request

      // Inscrire les employés sélectionnés
      if (selectedEmployes.length > 0) {
        await Promise.all(
          selectedEmployes.map((eid) =>
            api.post(`/formations/${data.id}/employes`, { employe_id: eid })
          )
        )
      }

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

  const allSelected = employes.length > 0 && selectedEmployes.length === employes.length

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

        {/* ── Section inscription par service ── */}
        <div className="formation-service-section">
          <div className="formation-service-header">
            <span className="formation-service-title">Inscrire des employes par service</span>
            <span className="formation-service-hint">Optionnel</span>
          </div>
          <div className="formation-service-select-wrap">
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="formation-service-select"
            >
              <option value="">— Choisir un service —</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.nom}</option>
              ))}
            </select>
          </div>

          {serviceId && (
            <div className="formation-employe-list">
              {loadingEmployes ? (
                <div className="formation-employe-loading">Chargement...</div>
              ) : employes.length === 0 ? (
                <div className="formation-employe-empty">Aucun employe actif dans ce service</div>
              ) : (
                <>
                  <label className="formation-employe-item formation-employe-all">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                    />
                    <span>Tout selectionner ({employes.length})</span>
                  </label>
                  <div className="formation-employe-scroll">
                    {employes.map((emp) => (
                      <label key={emp.id} className="formation-employe-item">
                        <input
                          type="checkbox"
                          checked={selectedEmployes.includes(emp.id)}
                          onChange={() => toggleEmploye(emp.id)}
                        />
                        <span className="formation-employe-name">
                          {emp.prenom} {emp.nom}
                        </span>
                        <span className="formation-employe-meta">{emp.matricule}</span>
                      </label>
                    ))}
                  </div>
                  {selectedEmployes.length > 0 && (
                    <div className="formation-employe-count">
                      {selectedEmployes.length} employe{selectedEmployes.length > 1 ? 's' : ''} selectionne{selectedEmployes.length > 1 ? 's' : ''}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
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
