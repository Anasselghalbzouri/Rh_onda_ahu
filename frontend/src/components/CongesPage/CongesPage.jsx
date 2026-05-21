import { useEffect, useRef, useState } from 'react'
import { Plus, Pencil, Trash2, Paperclip } from 'lucide-react'
import api from '../../api'
import './CongesPage.css'

const TYPES = ['annuel', 'maladie', 'maternite', 'sans_solde', 'exceptionnel']

const TYPE_LABEL = {
  annuel:       'Annuel',
  maladie:      'Maladie',
  maternite:    'Maternité',
  sans_solde:   'Sans solde',
  exceptionnel: 'Exceptionnel',
}

const EMPTY_FORM = {
  employe_id:   '',
  type_conge:   'annuel',
  date_debut:   '',
  date_fin:     '',
  nombre_jours: '',
  motif:        '',
  ref_hraccess: '',
  ref_onda_ahu: '',
}

const formatDate = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('fr-FR')
}

const countJours = (debut, fin) => {
  if (!debut || !fin) return 0
  const d = new Date(debut)
  const f = new Date(fin)
  if (f < d) return 0
  return Math.round((f - d) / 86400000) + 1
}

export default function CongesPage() {
  const [conges, setConges]             = useState([])
  const [meta, setMeta]                 = useState(null)
  const [page, setPage]                 = useState(1)
  const [filterType, setFilterType]     = useState('')
  const [filterEmp, setFilterEmp]       = useState('')
  const [loading, setLoading]           = useState(false)

  // Modal saisie (create / edit)
  const [modalOpen, setModalOpen]       = useState(false)
  const [editTarget, setEditTarget]     = useState(null) // null = create, objet = edit
  const [form, setForm]                 = useState(EMPTY_FORM)
  const [formErrors, setFormErrors]     = useState({})
  const [saving, setSaving]             = useState(false)
  const [fichierFile, setFichierFile]   = useState(null)
  const fileInputRef                    = useRef(null)

  // Autocomplete employé
  const [empSearch, setEmpSearch]       = useState('')
  const [empSuggestions, setEmpSuggestions] = useState([])

  // ── Fetch ──────────────────────────────────────────────────
  const fetchConges = async (p = 1) => {
    setLoading(true)
    try {
      const params = { page: p }
      if (filterType) params.type_conge  = filterType
      if (filterEmp)  params.employe_id  = filterEmp
      const { data } = await api.get('/conges', { params })
      setConges(data.data)
      setMeta(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { setPage(1); fetchConges(1) }, [filterType, filterEmp])
  const handlePage = (p) => { setPage(p); fetchConges(p) }

  // ── Recherche employé ──────────────────────────────────────
  const onEmpSearchChange = async (q) => {
    setEmpSearch(q)
    if (q.length < 2) { setEmpSuggestions([]); return }
    const { data } = await api.get('/employes', { params: { search: q } })
    setEmpSuggestions(data.data.slice(0, 6))
  }

  const selectEmp = (emp) => {
    setForm((f) => ({ ...f, employe_id: emp.id }))
    setEmpSearch(`${emp.prenom} ${emp.nom} (${emp.matricule})`)
    setEmpSuggestions([])
  }

  // ── Ouvrir modal ───────────────────────────────────────────
  const openCreate = () => {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
    setEmpSearch('')
    setEmpSuggestions([])
    setFichierFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setModalOpen(true)
  }

  const openEdit = (c) => {
    setEditTarget(c)
    setForm({
      employe_id:   c.employe_id,
      type_conge:   c.type_conge,
      date_debut:   c.date_debut?.slice(0, 10) ?? '',
      date_fin:     c.date_fin?.slice(0, 10)   ?? '',
      nombre_jours: c.nombre_jours ?? '',
      motif:        c.motif        ?? '',
      ref_hraccess: c.ref_hraccess ?? '',
      ref_onda_ahu: c.ref_onda_ahu ?? '',
    })
    setFormErrors({})
    setEmpSearch(c.employe ? `${c.employe.prenom} ${c.employe.nom} (${c.employe.matricule})` : '')
    setEmpSuggestions([])
    setFichierFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setModalOpen(true)
  }

  // ── Champs formulaire ──────────────────────────────────────
  const onFormChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => {
      const next = { ...prev, [name]: value }
      // Pré-remplir nombre_jours automatiquement quand les dates changent
      if (name === 'date_debut' || name === 'date_fin') {
        const debut = name === 'date_debut' ? value : prev.date_debut
        const fin   = name === 'date_fin'   ? value : prev.date_fin
        const calc  = countJours(debut, fin)
        if (calc > 0) next.nombre_jours = String(calc)
      }
      return next
    })
    setFormErrors((f) => ({ ...f, [name]: null }))
  }

  // ── Soumission ─────────────────────────────────────────────
  const onSubmit = async (e) => {
    e.preventDefault()
    setFormErrors({})
    setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => { if (v !== '') fd.append(k, v) })
      if (fichierFile) fd.append('fichier', fichierFile)

      if (editTarget) {
        await api.post(`/conges/${editTarget.id}?_method=PUT`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      } else {
        await api.post('/conges', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }

      setModalOpen(false)
      fetchConges(editTarget ? page : 1)
    } catch (err) {
      if (err.response?.status === 422) {
        const raw = err.response.data.errors ?? {}
        const flat = {}
        for (const [k, msgs] of Object.entries(raw)) {
          flat[k] = Array.isArray(msgs) ? msgs[0] : msgs
        }
        setFormErrors(flat)
      } else {
        setFormErrors({ general: 'Impossible de sauvegarder.' })
      }
    } finally {
      setSaving(false)
    }
  }

  // ── Supprimer ──────────────────────────────────────────────
  const handleDelete = async (c) => {
    const label = c.employe ? `${c.employe.prenom} ${c.employe.nom}` : `#${c.id}`
    if (!window.confirm(`Supprimer ce congé de ${label} ?\nLes jours seront recrédités au solde.`)) return
    await api.delete(`/conges/${c.id}`)
    fetchConges(page)
  }

  // ── Télécharger fichier ────────────────────────────────────
  const downloadFichier = (id) => {
    const base = (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')
    window.open(`${base}/api/conges/${id}/fichier`, '_blank')
  }

  // ── Rendu ──────────────────────────────────────────────────
  return (
    <div className="conges-container">

      <div className="conges-page-header">
        <p className="conges-page-subtitle">Gérer et suivre les demandes de congé</p>
        <h2 className="conges-title">Suivi des Congés</h2>
      </div>

      {/* Toolbar */}
      <div className="conges-toolbar">
        <div className="conges-filters">
          <select className="conges-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">Tous les types</option>
            {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
        </div>
        <button className="conges-add-btn" onClick={openCreate}>
          <Plus size={14} aria-hidden="true" />
          Saisir un congé
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <p className="conges-loading">Chargement...</p>
      ) : (
        <>
          <div className="conges-table-wrapper">
            <table className="conges-table">
              <thead>
                <tr>
                  <th>Employé</th>
                  <th>Type</th>
                  <th>Début</th>
                  <th>Fin</th>
                  <th>Jours</th>
                  <th>Solde restant</th>
                  <th>Réf HRaccess</th>
                  <th>Réf ONDA AHU</th>
                  <th>Doc</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {conges.length === 0 ? (
                  <tr><td colSpan={10} className="conges-empty">Aucun congé enregistré.</td></tr>
                ) : (
                  conges.map((c) => (
                    <tr key={c.id}>
                      <td className="conges-emp">
                        {c.employe ? `${c.employe.prenom} ${c.employe.nom}` : '—'}
                        {c.employe?.matricule && (
                          <span className="conges-matricule"> {c.employe.matricule}</span>
                        )}
                      </td>
                      <td>
                        <span className={`conges-type-badge type-${c.type_conge}`}>
                          {TYPE_LABEL[c.type_conge] ?? c.type_conge}
                        </span>
                      </td>
                      <td>{formatDate(c.date_debut)}</td>
                      <td>{formatDate(c.date_fin)}</td>
                      <td className="conges-jours">{c.nombre_jours}j</td>
                      <td className="conges-solde">
                        {c.solde_restant != null ? `${c.solde_restant}j` : '—'}
                      </td>
                      <td className="conges-ref">{c.ref_hraccess || '—'}</td>
                      <td className="conges-ref">{c.ref_onda_ahu  || '—'}</td>
                      <td>
                        {c.fichier_nom ? (
                          <button className="btn-file" title={c.fichier_nom} onClick={() => downloadFichier(c.id)} aria-label="Télécharger le fichier">
                            <Paperclip size={14} aria-hidden="true" />
                          </button>
                        ) : '—'}
                      </td>
                      <td className="conges-actions">
                        <button className="btn-edit"   onClick={() => openEdit(c)} aria-label="Modifier"><Pencil size={14} aria-hidden="true" /></button>
                        <button className="btn-delete" onClick={() => handleDelete(c)} aria-label="Supprimer"><Trash2 size={14} aria-hidden="true" /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {meta && meta.last_page > 1 && (
            <div className="conges-pagination">
              <button disabled={page === 1} onClick={() => handlePage(page - 1)}>← Précédent</button>
              <span>Page {meta.current_page} / {meta.last_page} ({meta.total} congés)</span>
              <button disabled={page === meta.last_page} onClick={() => handlePage(page + 1)}>Suivant →</button>
            </div>
          )}
        </>
      )}

      {/* MODAL SAISIE */}
      {modalOpen && (
        <div className="conges-overlay" onClick={() => setModalOpen(false)}>
          <div className="conges-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="conges-modal-title">
              {editTarget ? 'Modifier le congé' : 'Saisir un congé'}
            </h3>
            <form onSubmit={onSubmit}>

              {/* Employé — seulement à la création */}
              {!editTarget && (
                <div className="conges-field conges-field-full">
                  <label>Employé *</label>
                  <input
                    type="text"
                    placeholder="Rechercher par nom ou matricule..."
                    value={empSearch}
                    onChange={(e) => onEmpSearchChange(e.target.value)}
                    autoComplete="off"
                  />
                  {formErrors.employe_id && <span className="field-error">{formErrors.employe_id}</span>}
                  {empSuggestions.length > 0 && (
                    <ul className="conges-suggestions">
                      {empSuggestions.map((emp) => (
                        <li key={emp.id} onClick={() => selectEmp(emp)}>
                          {emp.prenom} {emp.nom} — {emp.matricule}
                          {emp.solde_conge != null && (
                            <span className="emp-solde"> · solde {emp.solde_conge}j</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Type + Dates */}
              <div className="conges-modal-grid">
                <div className="conges-field">
                  <label>Type de congé *</label>
                  <select name="type_conge" value={form.type_conge} onChange={onFormChange}>
                    {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                  </select>
                  {formErrors.type_conge && <span className="field-error">{formErrors.type_conge}</span>}
                </div>
                <div className="conges-field">
                  <label>Date début *</label>
                  <input type="date" name="date_debut" value={form.date_debut} onChange={onFormChange} />
                  {formErrors.date_debut && <span className="field-error">{formErrors.date_debut}</span>}
                </div>
                <div className="conges-field">
                  <label>Date fin *</label>
                  <input type="date" name="date_fin" value={form.date_fin} onChange={onFormChange} />
                  {formErrors.date_fin && <span className="field-error">{formErrors.date_fin}</span>}
                </div>
                <div className="conges-field">
                  <label>Nombre de jours *</label>
                  <input
                    type="number"
                    name="nombre_jours"
                    value={form.nombre_jours}
                    onChange={onFormChange}
                    min="1"
                    placeholder="Auto-calculé"
                  />
                  {formErrors.nombre_jours && <span className="field-error">{formErrors.nombre_jours}</span>}
                </div>
              </div>

              {/* Références */}
              <div className="conges-section-label">Références</div>
              <div className="conges-modal-grid">
                <div className="conges-field">
                  <label>Réf HRaccess</label>
                  <input
                    type="text"
                    name="ref_hraccess"
                    value={form.ref_hraccess}
                    onChange={onFormChange}
                    placeholder="Ex : HRA-2026-00123"
                  />
                  {formErrors.ref_hraccess && <span className="field-error">{formErrors.ref_hraccess}</span>}
                </div>
                <div className="conges-field">
                  <label>Réf ONDA AHU</label>
                  <input
                    type="text"
                    name="ref_onda_ahu"
                    value={form.ref_onda_ahu}
                    onChange={onFormChange}
                    placeholder="Ex : AHU-2026-00456"
                  />
                  {formErrors.ref_onda_ahu && <span className="field-error">{formErrors.ref_onda_ahu}</span>}
                </div>
              </div>

              {/* Motif */}
              <div className="conges-field conges-field-full">
                <label>Observation</label>
                <textarea name="motif" value={form.motif} onChange={onFormChange} rows={2} placeholder="Remarque éventuelle..." />
              </div>

              {/* Document physique */}
              <div className="conges-section-label">Document physique (dossier)</div>
              <div className="conges-field conges-field-full">
                <label>Importer un document (PDF, Word, image — max 10 Mo)</label>
                {editTarget?.fichier_nom && !fichierFile && (
                  <div className="conges-existing-file">
                    Fichier actuel : <strong>{editTarget.fichier_nom}</strong>
                    <button type="button" className="conges-file-remove" onClick={() => downloadFichier(editTarget.id)}>
                      Télécharger
                    </button>
                  </div>
                )}
                <div className="conges-file-zone" onClick={() => fileInputRef.current?.click()}>
                  {fichierFile ? (
                    <span className="conges-file-name">📎 {fichierFile.name}</span>
                  ) : (
                    <span className="conges-file-placeholder">
                      {editTarget?.fichier_nom ? 'Cliquer pour remplacer le fichier...' : 'Cliquer pour choisir un fichier...'}
                    </span>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  style={{ display: 'none' }}
                  onChange={(e) => setFichierFile(e.target.files[0] ?? null)}
                />
                {fichierFile && (
                  <button type="button" className="conges-file-remove" onClick={() => { setFichierFile(null); fileInputRef.current.value = '' }}>
                    Retirer
                  </button>
                )}
                {formErrors.fichier && <span className="field-error">{formErrors.fichier}</span>}
              </div>

              {formErrors.general && <div className="field-error mt-1">{formErrors.general}</div>}

              <div className="conges-modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setModalOpen(false)} disabled={saving}>
                  Annuler
                </button>
                <button type="submit" className="btn-submit" disabled={saving}>
                  {saving ? 'Enregistrement...' : editTarget ? 'Mettre à jour' : 'Enregistrer le congé'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
