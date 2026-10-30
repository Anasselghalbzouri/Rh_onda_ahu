import { useEffect, useState } from 'react'
import { Download, Users } from 'lucide-react'
import api from '../../api'
import Table from '../ui/Table/Table'
import './RapportEmployesPage.css'

const STATUTS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'actif', label: 'Actif' },
  { value: 'mute', label: 'Muté' },
  { value: 'retraite', label: 'Retraité' },
  { value: 'parti', label: 'Parti' },
  { value: 'suspendu', label: 'Suspendu' },
]

const COLONNES_INITIALES = ['matricule', 'nom', 'prenom']
const ERREUR_APERCU = 'Impossible de calculer l\'aperçu pour les filtres sélectionnés.'

const filtresParams = (serviceId, statut) => ({
  ...(serviceId ? { service_id: serviceId } : {}),
  ...(statut ? { statut } : {}),
})

export default function RapportEmployesPage() {
  const [services, setServices] = useState([])
  const [servicesError, setServicesError] = useState(null)
  const [serviceId, setServiceId] = useState('')
  const [statut, setStatut] = useState('')

  const [catalogue, setCatalogue] = useState([])
  const [colonnes, setColonnes] = useState(COLONNES_INITIALES)
  const [resultat, setResultat] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/services')
      .then(({ data }) => setServices(data ?? []))
      .catch(() => setServicesError('Impossible de charger la liste des services.'))
  }, [])

  // Un résultat ne vaut que pour la sélection qui l'a demandé : sinon, chargement en cours.
  const cle = `${serviceId}|${statut}|${reloadKey}|${colonnes.join(',')}`
  const { data: preview, erreur: previewError } = resultat?.cle === cle ? resultat : {}

  useEffect(() => {
    let ignore = false
    api.get('/rapport-employes', { params: { ...filtresParams(serviceId, statut), colonnes } })
      .then(({ data }) => {
        if (ignore) return
        setResultat({ cle, data })
        setCatalogue(data.colonnes ?? [])
      })
      .catch(() => {
        if (!ignore) setResultat({ cle, erreur: ERREUR_APERCU })
      })
    return () => { ignore = true }
  }, [cle, serviceId, statut, colonnes])

  const basculerColonne = (key) => {
    setColonnes((actuelles) => (
      actuelles.includes(key) ? actuelles.filter((c) => c !== key) : [...actuelles, key]
    ))
  }

  const exportRapport = async () => {
    setExporting(true)
    setError(null)
    try {
      const response = await api.get('/rapport-employes/export', {
        params: { ...filtresParams(serviceId, statut), colonnes },
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

  const colonnesChoisies = catalogue.filter((c) => colonnes.includes(c.key))

  return (
    <div className="rapport-container">
      <div className="rapport-page-header">
        <p className="rapport-page-subtitle">Exporter la liste du personnel</p>
        <h2 className="rapport-page-title">Rapport données employés</h2>
      </div>

      <div className="rapport-card">
        <p className="rapport-intro">
          Génère un fichier Excel avec les colonnes de votre choix. Le solde de congé n'est inclus
          que si vous le cochez ; les maladies, absences et demandes de congé n'y figurent jamais.
          Vous pouvez filtrer par service et par statut.
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

        {catalogue.length > 0 && (
          <fieldset className="rapport-colonnes">
            <legend>Colonnes à exporter</legend>
            <div className="rapport-colonnes-actions">
              <button type="button" className="rapport-btn-secondary" onClick={() => setColonnes(catalogue.map((c) => c.key))}>
                Tout cocher
              </button>
              <button type="button" className="rapport-btn-secondary" onClick={() => setColonnes([])}>
                Tout décocher
              </button>
            </div>
            <div className="rapport-colonnes-grid">
              {catalogue.map((c) => (
                <label key={c.key} className="rapport-colonne">
                  <input
                    type="checkbox"
                    checked={colonnes.includes(c.key)}
                    onChange={() => basculerColonne(c.key)}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {catalogue.length > 0 && (
          <div className="rapport-preview">
            <div className="rapport-preview-group">
              <h4><Users size={14} aria-hidden="true" /> Aperçu du fichier</h4>
              {colonnesChoisies.length > 0 ? (
                <Table
                  columns={colonnesChoisies}
                  rows={preview?.lignes ?? []}
                  loading={!preview && !previewError}
                  emptyText="Aucune donnée à afficher."
                />
              ) : (
                <p className="rapport-preview-total">Choisissez au moins une colonne à exporter.</p>
              )}
              <p className="rapport-preview-total" aria-live="polite">
                {preview ? (
                  <>Total : <strong>{preview.total}</strong> employé{preview.total > 1 ? 's' : ''}</>
                ) : 'Calcul du total...'}
              </p>
            </div>
          </div>
        )}

        {previewError && (
          <div className="rapport-error rapport-error-action">
            {previewError}
            <button type="button" className="rapport-btn-secondary" onClick={() => setReloadKey((k) => k + 1)}>
              Réessayer
            </button>
          </div>
        )}

        {preview && preview.total === 0 && (
          <div className="rapport-empty">
            <Users size={18} aria-hidden="true" />
            Aucun employé ne correspond aux critères sélectionnés.
          </div>
        )}

        {error && <div className="rapport-error">{error}</div>}

        <div className="rapport-actions">
          <button
            type="button"
            className="rapport-btn-primary"
            onClick={exportRapport}
            disabled={exporting || colonnes.length === 0 || !preview || preview.total === 0}
          >
            <Download size={15} aria-hidden="true" />
            {exporting ? 'Génération...' : 'Exporter'}
          </button>
        </div>
      </div>
    </div>
  )
}
