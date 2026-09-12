import { useEffect, useState } from 'react'
import { Download, Users } from 'lucide-react'
import api from '../../api'
import './RapportEmployesPage.css'

const STATUTS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'actif', label: 'Actif' },
  { value: 'mute', label: 'Muté' },
  { value: 'retraite', label: 'Retraité' },
  { value: 'parti', label: 'Parti' },
  { value: 'suspendu', label: 'Suspendu' },
]

export default function RapportEmployesPage() {
  const [services, setServices] = useState([])
  const [servicesError, setServicesError] = useState(null)
  const [serviceId, setServiceId] = useState('')
  const [statut, setStatut] = useState('')

  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/services')
      .then(({ data }) => setServices(data ?? []))
      .catch(() => setServicesError('Impossible de charger la liste des services.'))
  }, [])

  const buildParams = () => ({
    ...(serviceId ? { service_id: serviceId } : {}),
    ...(statut ? { statut } : {}),
  })

  const loadPreview = async () => {
    setPreviewLoading(true)
    setError(null)
    try {
      const { data } = await api.get('/rapport-employes', { params: buildParams() })
      setPreview(data)
    } catch {
      setError('Impossible de calculer l\'aperçu pour les filtres sélectionnés.')
      setPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const exportRapport = async () => {
    setExporting(true)
    setError(null)
    try {
      const response = await api.get('/rapport-employes/export', {
        params: buildParams(),
        responseType: 'blob',
      })
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const today = new Date().toISOString().split('T')[0]
      link.download = `Rapport_Employes_${today}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      setError('Échec de l\'export. Veuillez réessayer.')
    } finally {
      setExporting(false)
    }
  }

  const hasResults = preview !== null && preview.total > 0

  return (
    <div className="rapport-container">
      <div className="rapport-page-header">
        <p className="rapport-page-subtitle">Exporter la liste du personnel</p>
        <h2 className="rapport-page-title">Rapport données employés</h2>
      </div>

      <div className="rapport-card">
        <p className="rapport-intro">
          Génère un fichier Excel listant les informations administratives et de carrière
          de chaque employé. Le rapport exclut strictement les données de congés, maladies
          et absences. Vous pouvez le filtrer par service et par statut avant export.
        </p>

        {servicesError && <div className="rapport-error">{servicesError}</div>}

        <div className="rapport-form-grid">
          <label className="rapport-field">
            Service
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">Tous les services</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.nom}</option>
              ))}
            </select>
          </label>

          <label className="rapport-field">
            Statut
            <select value={statut} onChange={(e) => setStatut(e.target.value)}>
              {STATUTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>

        {error && <div className="rapport-error">{error}</div>}

        <div className="rapport-actions">
          <button
            type="button"
            className="rapport-btn-secondary"
            onClick={loadPreview}
            disabled={previewLoading}
          >
            {previewLoading ? 'Calcul...' : 'Aperçu'}
          </button>
          <button
            type="button"
            className="rapport-btn-primary"
            onClick={exportRapport}
            disabled={exporting || (preview !== null && preview.total === 0)}
          >
            <Download size={15} aria-hidden="true" />
            {exporting ? 'Génération...' : 'Exporter'}
          </button>
        </div>

        {preview && preview.total === 0 && (
          <div className="rapport-empty">
            <Users size={18} aria-hidden="true" />
            Aucun employé ne correspond aux critères sélectionnés.
          </div>
        )}

        {hasResults && (
          <div className="rapport-preview">
            <div className="rapport-preview-group">
              <h4><Users size={14} aria-hidden="true" /> Employés sélectionnés</h4>
              <p className="rapport-preview-total">
                Total : <strong>{preview.total}</strong> employé{preview.total > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
