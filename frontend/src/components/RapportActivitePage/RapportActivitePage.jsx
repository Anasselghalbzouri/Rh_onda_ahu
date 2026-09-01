import { useEffect, useState } from 'react'
import { FileSpreadsheet, Download } from 'lucide-react'
import api from '../../api'
import './RapportActivitePage.css'

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 6 }, (_, i) => currentYear - i)

export default function RapportActivitePage() {
  const [sheets, setSheets] = useState([])
  const [sheetsError, setSheetsError] = useState(null)
  const [sheet, setSheet] = useState('')
  const [annee, setAnnee] = useState(currentYear)
  const [trimestre, setTrimestre] = useState(1)

  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/rapport-activite/sheets')
      .then(({ data }) => {
        setSheets(data.sheets ?? [])
        if (data.sheets?.length) setSheet(data.sheets[data.sheets.length - 1])
      })
      .catch(() => setSheetsError("Modèle PS09 introuvable sur le serveur. Contactez l'administrateur."))
  }, [])

  const loadPreview = async () => {
    setPreviewLoading(true)
    setError(null)
    try {
      const { data } = await api.get('/rapport-activite', { params: { annee, trimestre } })
      setPreview(data)
    } catch {
      setError('Impossible de calculer les indicateurs pour cette période.')
      setPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const exportRapport = async () => {
    if (!sheet) return
    setExporting(true)
    setError(null)
    try {
      const response = await api.get('/rapport-activite/export', {
        params: { sheet, annee, trimestre },
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `PS09_Rapport_activite_${annee}_T${trimestre}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      setError("Échec de l'export. Vérifiez que le modèle PS09 est bien configuré côté serveur.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="rapport-container">
      <div className="rapport-page-header">
        <p className="rapport-page-subtitle">Générer le rapport qualité</p>
        <h2 className="rapport-page-title">Rapport d'activité PS09</h2>
      </div>

      <div className="rapport-card">
        <p className="rapport-intro">
          Remplit automatiquement les indicateurs calculables (formations, effectif)
          dans une copie du classeur PS09, sans jamais toucher aux graphiques. Les
          indicateurs sans source dans la plateforme (accidents du travail, polyvalence,
          réclamations, actions d'amélioration...) restent à saisir manuellement dans le
          fichier téléchargé, comme aujourd'hui.
        </p>

        {sheetsError && <div className="rapport-error">{sheetsError}</div>}

        <div className="rapport-form-grid">
          <label className="rapport-field">
            Feuille (trimestre du classeur)
            <select value={sheet} onChange={(e) => setSheet(e.target.value)}>
              {sheets.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          <label className="rapport-field">
            Année (calcul des indicateurs)
            <select value={annee} onChange={(e) => setAnnee(Number(e.target.value))}>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>

          <label className="rapport-field">
            Trimestre (calcul des indicateurs)
            <select value={trimestre} onChange={(e) => setTrimestre(Number(e.target.value))}>
              <option value={1}>T1 (Jan–Mar)</option>
              <option value={2}>T2 (Avr–Jun)</option>
              <option value={3}>T3 (Jul–Sep)</option>
              <option value={4}>T4 (Oct–Déc)</option>
            </select>
          </label>
        </div>

        {error && <div className="rapport-error">{error}</div>}

        <div className="rapport-actions">
          <button type="button" className="rapport-btn-secondary" onClick={loadPreview} disabled={previewLoading}>
            {previewLoading ? 'Calcul...' : 'Aperçu des indicateurs'}
          </button>
          <button
            type="button"
            className="rapport-btn-primary"
            onClick={exportRapport}
            disabled={exporting || !sheet}
          >
            <Download size={15} aria-hidden="true" />
            {exporting ? 'Génération...' : 'Exporter le rapport'}
          </button>
        </div>

        {preview && (
          <div className="rapport-preview">
            <div className="rapport-preview-group">
              <h4><FileSpreadsheet size={14} aria-hidden="true" /> Formations (T{preview.trimestre} {preview.annee})</h4>
              <ul>
                <li>Planifiées : <strong>{preview.formation.planifiees}</strong></li>
                <li>Réalisées : <strong>{preview.formation.realisees}</strong></li>
                <li>Évaluées : <strong>{preview.formation.evaluees}</strong></li>
                <li>Efficaces : <strong>{preview.formation.efficaces}</strong></li>
              </ul>
            </div>
            <div className="rapport-preview-group">
              <h4><FileSpreadsheet size={14} aria-hidden="true" /> Effectif ({preview.annee})</h4>
              <ul>
                <li>Intégrés : <strong>{preview.effectif.integres}</strong></li>
                <li>Départs : <strong>{preview.effectif.departs}</strong></li>
                <li>Mutations : <strong>{preview.effectif.mutations}</strong></li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
