import { useEffect, useRef, useState } from 'react'
import { Download, Plus } from 'lucide-react'
import api from '../../api'
import FormField from '../ui/FormField/FormField'
import Modal from '../ui/Modal/Modal'
import Table from '../ui/Table/Table'
import Toast from '../ui/Toast/Toast'
import { useToast } from '../ui/Toast/useToast'
import './ReclamationsPage.css'

const dateFr = (date) => (date ? date.split('-').reverse().join('/') : '')

const COLONNES = [
  { key: 'numero', label: 'Numéro réclamation' },
  { key: 'date_reception', label: 'Date de réception', format: dateFr },
  { key: 'matricule', label: 'Mle' },
  { key: 'nom_complet', label: 'Nom & Prénom' },
  { key: 'type', label: 'Type de réclamation', long: true },
  { key: 'description', label: 'Description de la réclamation', long: true },
  { key: 'canal', label: 'Canal utilisé par le réclamant' },
  { key: 'date_reponse_1', label: 'Date 1ère réponse', format: dateFr },
  { key: 'contenu_reponse_1', label: 'Contenu 1ère réponse apportée', long: true },
  { key: 'date_reponse_2', label: 'Date 2ème réponse', format: dateFr },
  { key: 'contenu_reponse_2', label: 'Contenu 2ème réponse apportée', long: true },
  { key: 'date_solution', label: 'Date de solution définitive', format: dateFr },
  { key: 'etat', label: 'État de réclamation', etat: true },
  { key: 'remarques', label: 'Autres remarques', long: true },
]

const valeurColonne = (colonne, row, options) => {
  const valeur = row[colonne.key]
  if (!valeur) return '—'
  if (colonne.format) return colonne.format(valeur)
  if (colonne.etat) return options?.etats.find((o) => o.key === valeur)?.label ?? valeur
  return valeur
}

const CHAMPS_CREATION = ['date_reception', 'type', 'canal', 'description', 'remarques']
const CHAMPS_SUIVI = [
  ...CHAMPS_CREATION,
  'date_reponse_1', 'contenu_reponse_1', 'date_reponse_2', 'contenu_reponse_2', 'date_solution', 'etat',
]

function FormulaireReclamation({ reclamation, options, onClose, onSaved }) {
  const champs = reclamation ? CHAMPS_SUIVI : CHAMPS_CREATION
  const [form, setForm] = useState(() => Object.fromEntries(champs.map((c) => [c, reclamation?.[c] ?? ''])))
  const [employeId, setEmployeId] = useState(null)
  const [empSearch, setEmpSearch] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [errors, setErrors] = useState({})
  const [erreurGenerale, setErreurGenerale] = useState(null)
  const [saving, setSaving] = useState(false)
  const derniereRecherche = useRef(0)

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const champ = (name, label, props = {}) => (
    <FormField label={label} name={name} value={form[name]} onChange={onChange} error={errors[name]} {...props} />
  )

  const onEmpSearchChange = async (q) => {
    const recherche = ++derniereRecherche.current
    setEmpSearch(q)
    setEmployeId(null)
    if (q.length < 2) { setSuggestions([]); return }
    try {
      const { data } = await api.get('/employes', { params: { search: q } })
      if (recherche === derniereRecherche.current) setSuggestions(data.data.slice(0, 6))
    } catch {
      if (recherche === derniereRecherche.current) setSuggestions([])
    }
  }

  const choisirEmploye = (emp) => {
    derniereRecherche.current += 1
    setEmployeId(emp.id)
    setEmpSearch(`${emp.nom} ${emp.prenom} — ${emp.matricule}`)
    setSuggestions([])
  }

  const envoyer = (action) => async () => {
    setSaving(true)
    setErrors({})
    setErreurGenerale(null)
    try {
      await action()
    } catch (err) {
      const recues = err.response?.status === 422 ? err.response.data.errors : null
      if (recues) {
        setErrors(Object.fromEntries(Object.entries(recues).map(([c, m]) => [c, m[0]])))
      } else {
        setErreurGenerale('L\'opération a échoué. Veuillez réessayer.')
      }
    } finally {
      setSaving(false)
    }
  }

  const enregistrer = envoyer(async () => {
    if (reclamation) {
      await api.put(`/reclamations/${reclamation.id}`, form)
      onSaved('Réclamation enregistrée.')
    } else {
      await api.post('/reclamations', { ...form, employe_id: employeId })
      onSaved('Réclamation créée.', true)
    }
  })

  const supprimer = () => {
    if (!window.confirm('Supprimer définitivement cette réclamation ?')) return
    envoyer(async () => {
      await api.delete(`/reclamations/${reclamation.id}`)
      onSaved('Réclamation supprimée.')
    })()
  }

  const onSubmit = (e) => {
    e.preventDefault()
    enregistrer()
  }

  return (
    <form className="reclamation-form" onSubmit={onSubmit} noValidate>
      {reclamation ? (
        <p className="reclamation-employe">{reclamation.matricule} — {reclamation.nom_complet}</p>
      ) : (
        <div className="ff-field reclamation-employe-champ">
          <label className="ff-label" htmlFor="reclamation-employe">Employé *</label>
          <input
            id="reclamation-employe"
            className={`ff-input${errors.employe_id ? ' ff-has-error' : ''}`}
            type="text"
            placeholder="Rechercher par nom ou matricule..."
            value={empSearch}
            onChange={(e) => onEmpSearchChange(e.target.value)}
            autoComplete="off"
          />
          {errors.employe_id && <span className="ff-error">{errors.employe_id}</span>}
          {suggestions.length > 0 && (
            <ul className="reclamation-suggestions">
              {suggestions.map((emp) => (
                <li key={emp.id}>
                  <button type="button" onClick={() => choisirEmploye(emp)}>
                    {emp.nom} {emp.prenom} — {emp.matricule}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="reclamation-form-grid">
        {champ('date_reception', 'Date de réception *', { type: 'date' })}
        {champ('type', 'Type de réclamation *')}
        {champ('canal', 'Canal utilisé par le réclamant *')}
        {reclamation && champ('etat', 'État de réclamation *', {
          type: 'select',
          options: (options?.etats ?? []).map((o) => ({ value: o.key, label: o.label })),
        })}
      </div>

      {champ('description', 'Description de la réclamation *', { type: 'textarea', rows: 3 })}

      {reclamation && (
        <>
          <div className="reclamation-form-grid">
            {champ('date_reponse_1', 'Date 1ère réponse', { type: 'date' })}
            {champ('date_reponse_2', 'Date 2ème réponse', { type: 'date' })}
            {champ('contenu_reponse_1', 'Contenu 1ère réponse apportée', { type: 'textarea', rows: 3 })}
            {champ('contenu_reponse_2', 'Contenu 2ème réponse apportée', { type: 'textarea', rows: 3 })}
            {champ('date_solution', 'Date de solution définitive', { type: 'date' })}
          </div>
        </>
      )}

      {champ('remarques', 'Autres remarques', { type: 'textarea', rows: 2 })}

      {erreurGenerale && <div className="reclamations-error">{erreurGenerale}</div>}

      <div className="reclamation-form-actions">
        {reclamation && (
          <button type="button" className="reclamations-btn-danger" onClick={supprimer} disabled={saving}>
            Supprimer
          </button>
        )}
        <button type="button" className="reclamations-btn-secondary" onClick={onClose} disabled={saving}>
          Annuler
        </button>
        <button type="submit" className="reclamations-btn-primary" disabled={saving}>
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}

export default function ReclamationsPage() {
  const { toast, showToast, hideToast } = useToast()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [etat, setEtat] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [options, setOptions] = useState(null)
  const [resultat, setResultat] = useState(null)
  // null : fermé ; { creation: true } : nouvelle réclamation ; sinon la réclamation ouverte.
  const [ouverte, setOuverte] = useState(null)

  // Un résultat ne vaut que pour la sélection qui l'a demandé : sinon, chargement en cours.
  const cle = `${page}|${search}|${etat}|${reloadKey}`
  const { data: liste, erreur } = resultat?.cle === cle ? resultat : {}

  useEffect(() => {
    let ignore = false
    api.get('/reclamations', { params: { page, search, etat } })
      .then(({ data }) => {
        if (ignore) return
        setOptions(data.options)
        // La dernière ligne de la dernière page vient d'être supprimée.
        if (data.current_page > data.last_page) setPage(data.last_page)
        else setResultat({ cle, data })
      })
      .catch(() => {
        if (!ignore) setResultat({ cle, erreur: 'Impossible de charger les réclamations.' })
      })
    return () => { ignore = true }
  }, [cle, page, search, etat])

  const filtrer = (setter) => (e) => {
    setter(e.target.value)
    setPage(1)
  }

  const onSaved = (message, premierePage = false) => {
    setOuverte(null)
    showToast(message, 'success')
    if (premierePage) setPage(1)
    setReloadKey((k) => k + 1)
  }

  const exporter = async () => {
    setExporting(true)
    try {
      const response = await api.get('/reclamations/export', { params: { search, etat }, responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `Tableau_suivi_reclamations_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      showToast('Échec de l\'export. Veuillez réessayer.', 'error')
    } finally {
      setExporting(false)
    }
  }

  const colonnesTable = COLONNES.map((c) => ({
    key: c.key,
    label: c.label,
    render: (_, row) => {
      const valeur = valeurColonne(c, row, options)
      // Bouton pour le clavier : son clic remonte à onRowClick de la ligne.
      if (c.key === 'numero') return <button type="button" className="reclamation-numero">{valeur}</button>
      return c.long ? <span className="reclamation-texte" title={valeur}>{valeur}</span> : valeur
    },
  }))

  const filtresActifs = Boolean(search || etat)

  return (
    <div className="reclamations-container">
      <div className="reclamations-header">
        <div>
          <p className="reclamations-subtitle">Tableau de suivi et de traitement</p>
          <h2 className="reclamations-title">Réclamations du personnel</h2>
        </div>
        <div className="reclamations-header-actions">
          <button
            type="button"
            className="reclamations-btn-secondary"
            onClick={exporter}
            disabled={exporting || !liste?.total}
          >
            <Download size={15} aria-hidden="true" />
            {exporting ? 'Export...' : 'Exporter Excel'}
          </button>
          <button type="button" className="reclamations-btn-primary" onClick={() => setOuverte({ creation: true })}>
            <Plus size={15} aria-hidden="true" />
            Nouvelle réclamation
          </button>
        </div>
      </div>

      <div className="reclamations-filtres">
        <input
          type="search"
          aria-label="Rechercher une réclamation"
          placeholder="Numéro, matricule, nom ou type..."
          value={search}
          onChange={filtrer(setSearch)}
        />
        <label htmlFor="reclamations-etat">État</label>
        <select id="reclamations-etat" value={etat} onChange={filtrer(setEtat)}>
          <option value="">Tous les états</option>
          {options?.etats.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      {erreur ? (
        <div className="reclamations-error reclamations-error-action">
          {erreur}
          <button type="button" className="reclamations-btn-secondary" onClick={() => setReloadKey((k) => k + 1)}>
            Réessayer
          </button>
        </div>
      ) : (
        <Table
          columns={colonnesTable}
          rows={liste?.data ?? []}
          loading={!liste}
          onRowClick={setOuverte}
          emptyText={filtresActifs ? 'Aucune réclamation ne correspond à votre recherche.' : 'Aucune réclamation enregistrée.'}
        />
      )}

      {liste && liste.last_page > 1 && (
        <div className="reclamations-pagination">
          <button type="button" className="reclamations-btn-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
            ← Précédent
          </button>
          <span>Page {liste.current_page} / {liste.last_page} ({liste.total} réclamations)</span>
          <button type="button" className="reclamations-btn-secondary" disabled={page === liste.last_page} onClick={() => setPage(page + 1)}>
            Suivant →
          </button>
        </div>
      )}

      <Modal
        isOpen={Boolean(ouverte)}
        onClose={() => setOuverte(null)}
        size="lg"
        title={ouverte?.creation ? 'Nouvelle réclamation' : `Réclamation ${ouverte?.numero}`}
      >
        {ouverte && (
          <FormulaireReclamation
            key={ouverte.id ?? 'creation'}
            reclamation={ouverte.creation ? null : ouverte}
            options={options}
            onClose={() => setOuverte(null)}
            onSaved={onSaved}
          />
        )}
      </Modal>

      <Toast toast={toast} onClose={hideToast} />
    </div>
  )
}
