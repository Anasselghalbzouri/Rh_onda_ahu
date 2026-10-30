import { useEffect, useRef, useState } from 'react'
import { Download, Save } from 'lucide-react'
import api from '../../api'
import { useAuth } from '../../useAuth'
import Ps09Sections from './Ps09Sections'
import Ps09Document from './Ps09Document'
import './RapportActivitePage.css'

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 6 }, (_, i) => currentYear - i)

// Copie modifiée de obj avec valeur au chemin keys (crée les niveaux manquants).
function setIn(obj, [cle, ...reste], valeur) {
  const copie = Array.isArray(obj) ? [...obj] : { ...(obj ?? {}) }
  copie[cle] = reste.length ? setIn(copie[cle], reste, valeur) : valeur
  return copie
}

export default function RapportActivitePage() {
  const readOnly = useAuth().user?.role === 'dg'
  const [annee, setAnnee] = useState(currentYear)
  const [trimestre, setTrimestre] = useState(Math.floor(new Date().getMonth() / 3) + 1)

  const [auto, setAuto] = useState(null)
  const [saisie, setSaisie] = useState(null)
  const [edits, setEdits] = useState({ trimestre: {}, annuel: {} })
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const [vue, setVue] = useState('excel')
  const [version, setVersion] = useState(0)
  const [excel, setExcel] = useState({ cle: null })
  // Clé de l'aperçu Excel : il est « en chargement » tant que la réponse reçue ne correspond pas à la clé courante.
  const cleExcel = `${annee}-${trimestre}-${version}`

  const [apercu, setApercu] = useState(null)
  const [apercuLoading, setApercuLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const appliquerSaisie = (data) => {
    setSaisie(data)
    setEdits({ trimestre: data.trimestres?.[trimestre] ?? {}, annuel: data.annuel ?? {} })
    setDirty(false)
    setErrors({})
  }

  // Les remises à zéro sont faites dans changerPeriode : pas de setState synchrone dans l'effet.
  const changerPeriode = (nouvelleAnnee, nouveauTrimestre) => {
    setLoading(true)
    setError(null)
    setMessage(null)
    setApercu(null)
    setAnnee(nouvelleAnnee)
    setTrimestre(nouveauTrimestre)
  }

  useEffect(() => {
    Promise.all([
      api.get('/rapport-activite', { params: { annee, trimestre } }),
      api.get('/rapport-activite/saisie', { params: { annee } }),
    ])
      .then(([stats, s]) => {
        setAuto(stats.data)
        appliquerSaisie(s.data)
      })
      .catch(() => setError('Impossible de charger le rapport pour cette période.'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annee, trimestre])

  useEffect(() => {
    if (vue !== 'excel') return undefined
    let actif = true
    api.get('/rapport-activite/export/visuel', { params: { annee, trimestre }, responseType: 'text' })
      .then(({ data }) => actif && setExcel({ cle: cleExcel, html: data }))
      .catch(() => actif && setExcel({ cle: cleExcel, erreur: true }))
    return () => { actif = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleExcel, vue])

  const cadreExcel = useRef(null)
  const [taille, setTaille] = useState({ largeur: 0, hauteur: 0, echelle: 1 })

  // Mesure la feuille rendue et calcule le zoom pour qu'elle tienne dans la largeur de la colonne.
  const ajusterExcel = () => {
    const iframe = cadreExcel.current
    const doc = iframe?.contentDocument
    if (!doc) return
    const largeur = doc.documentElement.scrollWidth
    const hauteur = doc.documentElement.scrollHeight
    const disponible = iframe.parentElement.clientWidth
    setTaille({ largeur, hauteur, echelle: Math.min(1, disponible / largeur) })
  }

  useEffect(() => {
    window.addEventListener('resize', ajusterExcel)
    return () => window.removeEventListener('resize', ajusterExcel)
  }, [])

  const onChange = (path, valeur) => {
    const [racine, ...keys] = path.split('.')
    setEdits((prev) => {
      let partie = prev[racine]
      if (keys[0] === 'engagements' && !Array.isArray(partie.engagements)) {
        partie = { ...partie, engagements: [{}, {}, {}] }
      }
      return { ...prev, [racine]: setIn(partie, keys, valeur) }
    })
    setDirty(true)
    setMessage(null)
    setApercu(null)
  }

  const enregistrer = async () => {
    setSaving(true)
    setErrors({})
    setError(null)
    try {
      const { data } = await api.put(`/rapport-activite/saisie/${annee}/${trimestre}`, edits)
      appliquerSaisie(data)
      setMessage('Rapport enregistré.')
      setVersion((v) => v + 1) // régénère l'aperçu Excel avec les données enregistrées
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data.errors ?? {})
        setError('Certaines valeurs sont invalides : corrigez les champs signalés.')
      } else {
        setError("Impossible d'enregistrer le rapport.")
      }
    } finally {
      setSaving(false)
    }
  }

  const annuler = () => saisie && appliquerSaisie(saisie)

  const preparerExport = async () => {
    if (dirty) return
    setApercuLoading(true)
    setError(null)
    try {
      const { data } = await api.get('/rapport-activite/export/apercu', { params: { annee, trimestre } })
      setApercu(data)
    } catch {
      setError("Impossible de préparer l'export. Vérifiez que le modèle PS09 est bien configuré côté serveur.")
    } finally {
      setApercuLoading(false)
    }
  }

  const exportRapport = async () => {
    setExporting(true)
    setError(null)
    try {
      const response = await api.get('/rapport-activite/export', {
        params: { annee, trimestre },
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
      setApercu(null)
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
          Choisissez l'année et le trimestre : le rapport s'affiche ci-dessous, section par section.
          Les indicateurs formations et effectif sont calculés automatiquement ; les commentaires et
          les tableaux (réclamations, accidents, engagements, plan d'action, stages, polyvalence) se
          saisissent ici, puis s'exportent dans le classeur PS09.
        </p>

        <div className="rapport-form-grid">
          <label className="rapport-field">
            Année
            <select value={annee} disabled={dirty} onChange={(e) => changerPeriode(Number(e.target.value), trimestre)}>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>

          <label className="rapport-field">
            Trimestre
            <select value={trimestre} disabled={dirty} onChange={(e) => changerPeriode(annee, Number(e.target.value))}>
              <option value={1}>T1 (Jan–Mar)</option>
              <option value={2}>T2 (Avr–Jun)</option>
              <option value={3}>T3 (Jul–Sep)</option>
              <option value={4}>T4 (Oct–Déc)</option>
            </select>
          </label>
        </div>

        {dirty && (
          <div className="ps09-bandeau">
            Modifications non enregistrées : enregistrez ou annulez-les avant de changer de période ou d'exporter.
            <button type="button" className="rapport-btn-secondary" onClick={annuler}>Annuler les modifications</button>
          </div>
        )}
        {error && <div className="rapport-error">{error}</div>}
        {message && <div className="ps09-succes">{message}</div>}
      </div>

      {loading && <div className="rapport-card">Chargement du rapport...</div>}

      {!loading && saisie && (
        <div className={`ps09-cote-a-cote ${readOnly ? 'ps09-seul' : ''}`}>
          {!readOnly && (
            <div className="rapport-card ps09-colonne-saisie">
              <h3 className="ps09-colonne-titre">Saisie</h3>
              <Ps09Sections
                auto={auto}
                trimestre={edits.trimestre}
                annuel={edits.annuel}
                numTrimestre={trimestre}
                annee={annee}
                onChange={onChange}
                errors={errors}
              />
              <div className="rapport-actions ps09-actions-collantes">
                <button type="button" className="rapport-btn-primary" onClick={enregistrer} disabled={saving || !dirty}>
                  <Save size={15} aria-hidden="true" />
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          )}

          <div className="ps09-colonne-apercu">
          <div className="ps09-onglets">
            <div role="tablist" aria-label="Aperçu du rapport">
              <button type="button" role="tab" aria-selected={vue === 'excel'} className={vue === 'excel' ? 'actif' : ''} onClick={() => setVue('excel')}>Aperçu Excel</button>
              <button type="button" role="tab" aria-selected={vue === 'synthese'} className={vue === 'synthese' ? 'actif' : ''} onClick={() => setVue('synthese')}>Synthèse</button>
            </div>
          </div>

          {vue === 'excel' ? (
            <div className="rapport-card ps09-excel">
              {dirty && <p className="ps09-erreur">Aperçu des données enregistrées : enregistrez pour voir vos dernières modifications.</p>}
              {excel.cle !== cleExcel ? (
                <p>Génération de l'aperçu Excel...</p>
              ) : excel.erreur ? (
                <div className="rapport-error">Impossible d'afficher la feuille Excel. Vérifiez le modèle PS09.</div>
              ) : (
                // La feuille entière, réduite à la largeur de la colonne, sans barre de défilement interne.
                <div className="ps09-excel-cadre" style={{ height: taille.hauteur * taille.echelle || undefined }}>
                  {/* allow-same-origin sans allow-scripts : aucun script exécuté, mais la page peut mesurer la feuille. */}
                  <iframe
                    ref={cadreExcel}
                    title={`Aperçu Excel — PS09 T${trimestre} ${annee}`}
                    sandbox="allow-same-origin"
                    scrolling="no"
                    srcDoc={excel.html}
                    onLoad={ajusterExcel}
                    className="ps09-excel-frame"
                    style={taille.largeur ? { width: taille.largeur, height: taille.hauteur, transform: `scale(${taille.echelle})` } : undefined}
                  />
                </div>
              )}
              <p className="ps09-note">Mise en forme identique au classeur ; les graphiques Excel apparaissent uniquement dans le fichier exporté.</p>
            </div>
          ) : (
            <Ps09Document
              auto={auto}
              trimestre={edits.trimestre}
              annuel={edits.annuel}
              numTrimestre={trimestre}
              annee={annee}
            />
          )}

          <div className="rapport-card ps09-export">
            <h3>Exporter le rapport</h3>
            {dirty && <p className="ps09-erreur">Enregistrez vos modifications avant d'exporter.</p>}
            <div className="rapport-actions">
              <button type="button" className="rapport-btn-secondary" onClick={preparerExport} disabled={dirty || apercuLoading}>
                <Download size={15} aria-hidden="true" />
                {apercuLoading ? 'Préparation...' : 'Exporter Excel'}
              </button>
            </div>

            {apercu && (
              <div className="ps09-recap">
                <p>Feuille : <strong>{apercu.sheet}</strong></p>
                {apercu.non_places.length > 0 && (
                  <div className="ps09-non-places">
                    <strong>Ne sera pas placé — ajoutez la ligne dans le classeur maître :</strong>
                    <ul>{apercu.non_places.map((l) => <li key={l}>{l}</li>)}</ul>
                  </div>
                )}
                <details>
                  <summary>Sera placé ({apercu.places.length} valeur{apercu.places.length > 1 ? 's' : ''} saisie{apercu.places.length > 1 ? 's' : ''}, en plus des indicateurs automatiques)</summary>
                  <ul>{apercu.places.map((p) => <li key={p.libelle}>{p.libelle} → {p.cellule}</li>)}</ul>
                </details>
                <div className="rapport-actions">
                  <button type="button" className="rapport-btn-primary" onClick={exportRapport} disabled={exporting}>
                    <Download size={15} aria-hidden="true" />
                    {exporting ? 'Génération...' : "Confirmer l'export"}
                  </button>
                  <button type="button" className="rapport-btn-secondary" onClick={() => setApercu(null)}>Annuler</button>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      )}
    </div>
  )
}
