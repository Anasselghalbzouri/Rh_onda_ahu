/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react'
import { ArrowUpDown, Eye, Plus, SlidersHorizontal, X } from 'lucide-react'
import api from '../../api'
import FormField from '../ui/FormField/FormField'
import './ListeEmployes.css'

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('fr-FR')
}

const STATUTS = ['actif', 'mute', 'retraite', 'parti', 'suspendu']

const EMPTY_FORM = {
  matricule: '', nom: '', prenom: '', sexe: '',
  date_naissance: '', date_embauche: '', categorie: '',
  echelle: '', echelon: '', fonction: '', qualification: '',
  entite: '', affectation: '', solde_conge: '', statut: 'actif',
}

export default function ListeEmployes({ onSelectEmploye }) {
  const [employes, setEmployes] = useState([])
  const [meta, setMeta] = useState(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statut, setStatut] = useState('')
  const [sortKey, setSortKey] = useState('nom')
  const [sortDir, setSortDir] = useState('asc')
  const [density, setDensity] = useState('comfortable')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(false)

const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [createErrors, setCreateErrors] = useState({})
  const [createSaving, setCreateSaving] = useState(false)

  const fetchEmployes = async (p = 1) => {
    setLoading(true)
    try {
      const { data } = await api.get('/employes', {
        params: { page: p, search, statut },
      })
      setEmployes(data.data)
      setMeta(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(1)
    fetchEmployes(1)
  }, [search, statut])

  const handlePage = (p) => {
    setPage(p)
    fetchEmployes(p)
  }

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedEmployes = [...employes].sort((a, b) => {
    const getValue = (emp) => {
      if (sortKey === 'service') return emp.service?.nom ?? ''
      return emp[sortKey] ?? ''
    }
    const av = String(getValue(a)).toLocaleLowerCase('fr-FR')
    const bv = String(getValue(b)).toLocaleLowerCase('fr-FR')
    return sortDir === 'asc' ? av.localeCompare(bv, 'fr') : bv.localeCompare(av, 'fr')
  })

  const activeFilters = [
    search && { key: 'search', label: `Recherche : ${search}`, clear: () => setSearch('') },
    statut && { key: 'statut', label: `Statut : ${statut}`, clear: () => setStatut('') },
  ].filter(Boolean)

  const initials = (emp) => `${emp.prenom?.[0] ?? ''}${emp.nom?.[0] ?? ''}`.toUpperCase() || 'RH'

  const openCreate = () => {
    setCreateForm(EMPTY_FORM)
    setCreateErrors({})
    setCreateOpen(true)
  }

  const onCreateChange = (e) => {
    const { name, value } = e.target
    setCreateForm((prev) => ({ ...prev, [name]: value }))
    setCreateErrors((prev) => ({ ...prev, [name]: null }))
  }

  const onCreateSubmit = async (e) => {
    e.preventDefault()
    setCreateErrors({})
    setCreateSaving(true)
    try {
      await api.post('/employes', createForm)
      setCreateOpen(false)
      setPage(1)
      fetchEmployes(1)
    } catch (err) {
      if (err.response?.status === 422) {
        const raw = err.response.data.errors ?? {}
        const flat = {}
        for (const [key, msgs] of Object.entries(raw)) {
          flat[key] = Array.isArray(msgs) ? msgs[0] : msgs
        }
        setCreateErrors(flat)
      } else {
        setCreateErrors({ general: "Impossible de créer l'employé." })
      }
    } finally {
      setCreateSaving(false)
    }
  }

  return (
    <div className="liste-container">
      <div className="liste-page-header">
        <p className="liste-page-subtitle">Consulter et gérer le personnel</p>
        <h2 className="liste-page-title">Personnel</h2>
      </div>

      <div className="liste-toolbar">
        <input
          className="liste-search-input"
          type="text"
          placeholder="Rechercher nom, prénom, matricule, fonction..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Rechercher un employé"
        />
        <select
          className="liste-select"
          value={statut}
          onChange={(e) => setStatut(e.target.value)}
          aria-label="Filtrer par statut"
        >
          <option value="">Tous les statuts</option>
          <option value="actif">Actif</option>
          <option value="retraite">Retraité</option>
          <option value="depart_volontaire">Départ volontaire</option>
        </select>
        <button className="liste-ghost-btn" type="button" onClick={() => setShowAdvanced((v) => !v)}>
          <SlidersHorizontal size={14} aria-hidden="true" />
          Filtres
        </button>
        <div className="liste-density" aria-label="Densité du tableau">
          <button type="button" className={density === 'comfortable' ? 'active' : ''} onClick={() => setDensity('comfortable')}>Confort</button>
          <button type="button" className={density === 'dense' ? 'active' : ''} onClick={() => setDensity('dense')}>Dense</button>
        </div>
        <button className="liste-add-btn" onClick={openCreate}>
          <Plus size={14} aria-hidden="true" />
          Ajouter un employé
        </button>
      </div>

      {showAdvanced && (
        <div className="liste-advanced">
          <div>
            <span className="liste-advanced-label">Tri actif</span>
            <strong>{sortKey} · {sortDir === 'asc' ? 'croissant' : 'décroissant'}</strong>
          </div>
          <div>
            <span className="liste-advanced-label">Affichage</span>
            <strong>{density === 'dense' ? 'Table compacte' : 'Table confortable'}</strong>
          </div>
        </div>
      )}

      {activeFilters.length > 0 && (
        <div className="liste-filter-chips">
          {activeFilters.map((filter) => (
            <button key={filter.key} type="button" onClick={filter.clear}>
              {filter.label}
              <X size={13} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="liste-loading">Chargement...</p>
      ) : (
        <>
          <div className={`liste-table-wrapper liste-density-${density}`}>
            <table className="liste-table">
              <thead className="liste-thead">
                <tr>
                  {[
                    ['matricule', 'Matricule'],
                    ['nom', 'Nom complet'],
                    ['fonction', 'Fonction'],
                    ['service', 'Service'],
                    ['date_embauche', 'Date embauche'],
                    ['statut', 'Statut'],
                  ].map(([key, label]) => (
                    <th key={key} className="liste-th">
                      <button type="button" onClick={() => toggleSort(key)}>
                        {label}
                        <ArrowUpDown size={12} aria-hidden="true" />
                      </button>
                    </th>
                  ))}
                  <th className="liste-th">Solde</th>
                  <th className="liste-th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="liste-empty">
                      Aucun employé trouvé.
                    </td>
                  </tr>
                ) : (
                  sortedEmployes.map((emp) => (
                    <tr key={emp.id} className="liste-tr">
                      <td className="liste-td">{emp.matricule}</td>
                      <td className="liste-td">
                        <div className="liste-employee-cell">
                          <span className="liste-avatar">{initials(emp)}</span>
                          <span>
                            <strong>{emp.prenom} {emp.nom}</strong>
                            <small>{emp.categorie ?? 'Catégorie non renseignée'}</small>
                          </span>
                        </div>
                      </td>
                      <td className="liste-td">{emp.fonction ?? '—'}</td>
                      <td className="liste-td">
                        <span className="liste-service-badge">{emp.service?.nom ?? '—'}</span>
                      </td>
                      <td className="liste-td">{formatDate(emp.date_embauche)}</td>
                      <td className="liste-td">
                        <span className={`liste-badge ${emp.statut === 'actif' ? 'liste-badge-actif' : 'liste-badge-inactif'}`}>
                          {emp.statut ?? '—'}
                        </span>
                      </td>
                      <td className="liste-td">
                        <span className={Number(emp.solde_conge ?? 0) < 5 ? 'liste-solde low' : 'liste-solde'}>
                          {emp.solde_conge ?? 0}j
                        </span>
                      </td>
                      <td className="liste-td">
                        <button
                          type="button"
                          className="liste-action-btn"
                          onClick={() => onSelectEmploye && onSelectEmploye(emp.id)}
                          aria-label={`Voir la fiche de ${emp.prenom} ${emp.nom}`}
                        >
                          <Eye size={14} aria-hidden="true" />
                          Voir
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {meta && meta.last_page > 1 && (
            <div className="liste-pagination">
              <button
                className="liste-page-btn"
                disabled={page === 1}
                onClick={() => handlePage(page - 1)}
              >
                ← Précédent
              </button>
              <span className="liste-page-info">
                Page {meta.current_page} / {meta.last_page}
                &nbsp;({meta.total} employés)
              </span>
              <button
                className="liste-page-btn"
                disabled={page === meta.last_page}
                onClick={() => handlePage(page + 1)}
              >
                Suivant →
              </button>
            </div>
          )}
        </>
      )}

      {createOpen && (
        <div className="liste-overlay" onClick={() => setCreateOpen(false)}>
          <div className="liste-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="liste-modal-title">Nouvel employé</h3>
            <form onSubmit={onCreateSubmit}>
              <div className="liste-modal-grid">
                <FormField label="Matricule *"     name="matricule"      value={createForm.matricule}      onChange={onCreateChange} error={createErrors.matricule} />
                <FormField label="Nom *"           name="nom"            value={createForm.nom}            onChange={onCreateChange} error={createErrors.nom} />
                <FormField label="Prénom *"        name="prenom"         value={createForm.prenom}         onChange={onCreateChange} error={createErrors.prenom} />
                <FormField label="Sexe"            name="sexe"           value={createForm.sexe}           onChange={onCreateChange} error={createErrors.sexe} type="select"
                  options={[{ value: 'M', label: 'Masculin' }, { value: 'F', label: 'Féminin' }]} />
                <FormField label="Statut"          name="statut"         value={createForm.statut}         onChange={onCreateChange} error={createErrors.statut} type="select"
                  options={STATUTS.map((s) => ({ value: s, label: s }))} />
                <FormField label="Date naissance"  name="date_naissance" value={createForm.date_naissance} onChange={onCreateChange} error={createErrors.date_naissance} type="date" />
                <FormField label="Date embauche"   name="date_embauche"  value={createForm.date_embauche}  onChange={onCreateChange} error={createErrors.date_embauche} type="date" />
                <FormField label="Catégorie"       name="categorie"      value={createForm.categorie}      onChange={onCreateChange} error={createErrors.categorie} />
                <FormField label="Échelle"         name="echelle"        value={createForm.echelle}        onChange={onCreateChange} error={createErrors.echelle} />
                <FormField label="Échelon"         name="echelon"        value={createForm.echelon}        onChange={onCreateChange} error={createErrors.echelon} />
                <FormField label="Fonction"        name="fonction"       value={createForm.fonction}       onChange={onCreateChange} error={createErrors.fonction} />
                <FormField label="Qualification"   name="qualification"  value={createForm.qualification}  onChange={onCreateChange} error={createErrors.qualification} />
                <FormField label="Entité"          name="entite"         value={createForm.entite}         onChange={onCreateChange} error={createErrors.entite} />
                <FormField label="Affectation"     name="affectation"    value={createForm.affectation}    onChange={onCreateChange} error={createErrors.affectation} />
                <FormField label="Solde congé (j)" name="solde_conge"    value={createForm.solde_conge}    onChange={onCreateChange} error={createErrors.solde_conge} type="number" />
              </div>

              {createErrors.general && (
                <div className="liste-form-error">{createErrors.general}</div>
              )}

              <div className="liste-modal-actions">
                <button type="button" className="liste-cancel-btn" onClick={() => setCreateOpen(false)} disabled={createSaving}>
                  Annuler
                </button>
                <button type="submit" className="liste-submit-btn" disabled={createSaving}>
                  {createSaving ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
