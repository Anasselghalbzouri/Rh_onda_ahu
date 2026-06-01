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
  const [searchEmploye, setSearchEmploye] = useState('')

  useEffect(() => {
    if (!isOpen) return
    api.get('/services').then(({ data }) => setServices(data)).catch(() => {})
  }, [isOpen])

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

  // Choisir un service pré-remplit l'intitulé de la formation avec le nom du service et charge la liste de ses employés.
  const onServiceChange = (e) => {
    const id = e.target.value
    const nom = services.find((s) => String(s.id) === id)?.nom ?? ''
    setServiceId(id)
    setSearchEmploye('')
    setForm((prev) => ({ ...prev, intitule: nom }))
    setErrors((prev) => ({ ...prev, intitule: null, general: null }))
  }

  const toggleEmploye = (id) => {
    setSelectedEmployes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const toggleAll = () => {
    const ids = filteredEmployes.map((e) => e.id)
    const allChecked = ids.every((id) => selectedEmployes.includes(id))
    setSelectedEmployes((prev) =>
      allChecked ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]
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

  const filteredEmployes = employes.filter((emp) => {
    const q = searchEmploye.toLowerCase()
    return (
      emp.nom?.toLowerCase().includes(q) ||
      emp.prenom?.toLowerCase().includes(q) ||
      emp.matricule?.toLowerCase().includes(q)
    )
  })

  const allSelected = filteredEmployes.length > 0 && filteredEmployes.every((e) => selectedEmployes.includes(e.id))

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

          <div className="ff-field">
            <label className="ff-label">Collaborateur</label>
            <select
              value={serviceId}
              onChange={onServiceChange}
              className={`ff-input${errors.intitule ? ' ff-has-error' : ''}`}
              required
            >
              <option value="">— Choisir un service —</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.nom}</option>
              ))}
            </select>
            {errors.intitule && <span className="ff-error">{errors.intitule}</span>}
          </div>

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

        {serviceId && (
          <div className="formation-service-section">
            <div className="formation-service-header">
              <span className="formation-service-title">Inscrire des employes par service</span>
              <span className="formation-service-hint">Optionnel</span>
            </div>
            <div className="formation-employe-list">
              {loadingEmployes ? (
                <div className="formation-employe-loading">Chargement...</div>
              ) : employes.length === 0 ? (
                <div className="formation-employe-empty">Aucun employe actif dans ce service</div>
              ) : (
                <>
                  <input
                    type="text"
                    className="formation-employe-search"
                    placeholder="Rechercher par nom, prénom ou matricule..."
                    value={searchEmploye}
                    onChange={(e) => setSearchEmploye(e.target.value)}
                  />
                  <label className="formation-employe-item formation-employe-all">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                    />
                    <span>Tout selectionner ({filteredEmployes.length})</span>
                  </label>
                  <div className="formation-employe-scroll">
                    {filteredEmployes.length === 0 ? (
                      <div className="formation-employe-empty">Aucun résultat</div>
                    ) : filteredEmployes.map((emp) => (
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
          </div>
        )}

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
