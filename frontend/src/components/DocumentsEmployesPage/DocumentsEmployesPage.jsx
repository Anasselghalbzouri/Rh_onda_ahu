/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileCheck2, Plus, Search } from 'lucide-react'
import api from '../../api'
import Table from '../ui/Table/Table'
import Badge from '../ui/Badge/Badge'
import Modal from '../ui/Modal/Modal'
import FormField from '../ui/FormField/FormField'
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_STATUTS,
  DOCUMENT_STATUT_LABELS,
  DOCUMENT_STATUT_VARIANTS,
} from '../../constants/documentsEmployes'
import { telechargerPieceJointe } from '../../utils/telechargerPieceJointe'
import './DocumentsEmployesPage.css'

const PIECES_ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx'

const EMPTY_FORM = {
  fichier: null,
  categorie: '',
  description: '',
  date_expiration: '',
  obligatoire: false,
}

const formatDate = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('fr-FR')
}

export default function DocumentsEmployesPage({ readOnly = false }) {
  const navigate = useNavigate()

  const [documents, setDocuments] = useState([])
  const [meta, setMeta] = useState(null)
  const [page, setPage] = useState(1)
  const [recherche, setRecherche] = useState('')
  const [filtreCategorie, setFiltreCategorie] = useState('')
  const [filtreStatut, setFiltreStatut] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [empSearch, setEmpSearch] = useState('')
  const [empSuggestions, setEmpSuggestions] = useState([])
  const [empSelection, setEmpSelection] = useState(null)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteError, setDeleteError] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetchDocuments = async (p = 1) => {
    setLoading(true)
    setError(null)
    try {
      const params = { page: p }
      if (recherche) params.q = recherche
      if (filtreCategorie) params.categorie = filtreCategorie
      if (filtreStatut) params.statut = filtreStatut
      const { data } = await api.get('/documents-employes', { params })
      setDocuments(Array.isArray(data?.data) ? data.data : [])
      setMeta(data?.meta ?? null)
    } catch {
      setError('Impossible de charger les documents employés.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { setPage(1); fetchDocuments(1) }, [filtreCategorie, filtreStatut])

  const onRechercheSubmit = (e) => {
    e.preventDefault()
    setPage(1)
    fetchDocuments(1)
  }

  const handlePage = (p) => { setPage(p); fetchDocuments(p) }

  const onEmpSearchChange = async (q) => {
    setEmpSearch(q)
    setEmpSelection(null)
    if (q.length < 2) { setEmpSuggestions([]); return }
    const { data } = await api.get('/employes', { params: { search: q } })
    setEmpSuggestions((data?.data ?? []).slice(0, 6))
  }

  const openAdd = () => {
    setForm(EMPTY_FORM)
    setFormErrors({})
    setEmpSearch('')
    setEmpSuggestions([])
    setEmpSelection(null)
    setAddOpen(true)
  }

  const onFormChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    setFormErrors((prev) => ({ ...prev, [name]: null }))
  }

  const onAddSubmit = async (e) => {
    e.preventDefault()
    setFormErrors({})
    if (!empSelection) {
      setFormErrors((prev) => ({ ...prev, employe: 'Sélectionnez un employé.' }))
      return
    }
    if (!form.fichier) {
      setFormErrors((prev) => ({ ...prev, fichier: 'Sélectionnez un fichier.' }))
      return
    }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('fichier', form.fichier)
      if (form.categorie) fd.append('categorie', form.categorie)
      if (form.description) fd.append('description', form.description)
      if (form.date_expiration) fd.append('date_expiration', form.date_expiration)
      fd.append('obligatoire', form.obligatoire ? '1' : '0')
      await api.post(`/employes/${empSelection.id}/pieces-jointes`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setAddOpen(false)
      fetchDocuments(page)
    } catch (err) {
      if (err.response?.status === 422) {
        const raw = err.response.data.errors ?? {}
        const flat = {}
        for (const [k, msgs] of Object.entries(raw)) {
          flat[k] = Array.isArray(msgs) ? msgs[0] : msgs
        }
        setFormErrors(flat)
      } else {
        setFormErrors({ global: "Impossible d'ajouter le document." })
      }
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!deleteTarget) return
    setDeleteError(null)
    setDeleting(true)
    try {
      await api.delete(`/pieces-jointes/${deleteTarget.id}`)
      setDeleteTarget(null)
      fetchDocuments(page)
    } catch {
      setDeleteError('Impossible de supprimer le document.')
    } finally {
      setDeleting(false)
    }
  }

  const columns = [
    {
      key: 'employe',
      label: 'Employé',
      render: (_, row) => row.employe ? (
        <button
          type="button"
          className="de-link-btn"
          onClick={(e) => {
            e.stopPropagation()
            navigate('/personnel', { state: { selectedEmployeId: row.employe.id } })
          }}
        >
          {row.employe.prenom} {row.employe.nom}
          <span className="de-matricule"> ({row.employe.matricule})</span>
        </button>
      ) : '—',
    },
    { key: 'nom_original', label: 'Document', render: (v) => v ?? '—' },
    { key: 'categorie', label: 'Catégorie' },
    {
      key: 'statut',
      label: 'Statut',
      render: (v) => (
        <Badge variant={DOCUMENT_STATUT_VARIANTS[v] ?? 'default'}>
          {DOCUMENT_STATUT_LABELS[v] ?? v ?? '—'}
        </Badge>
      ),
    },
    { key: 'date_expiration', label: 'Expiration', render: (v) => formatDate(v) },
    { key: 'date_upload', label: 'Ajouté le', render: (v) => v ?? '—' },
    { key: 'taille', label: 'Taille', render: (v) => v ?? '—' },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="de-actions">
          {row.id && (
            <button
              type="button"
              className="de-link-btn"
              onClick={(e) => { e.stopPropagation(); telechargerPieceJointe(row) }}
            >
              Télécharger
            </button>
          )}
          {!readOnly && row.id && (
            <button
              type="button"
              className="de-delete-btn"
              onClick={(e) => { e.stopPropagation(); setDeleteError(null); setDeleteTarget(row) }}
            >
              Supprimer
            </button>
          )}
        </div>
      ),
    },
  ]

  const totalPages = meta ? Math.max(1, Math.ceil((meta.total ?? 0) / 20)) : 1

  return (
    <div className="de-container">
      <div className="de-page-header">
        <p className="de-page-subtitle">Gestion documentaire</p>
        <h2 className="de-title">
          <FileCheck2 size={24} aria-hidden="true" /> Documents employés
        </h2>
      </div>

      <div className="de-toolbar">
        <div className="de-filters">
          <form className="de-filter-search" onSubmit={onRechercheSubmit}>
            <Search size={15} aria-hidden="true" />
            <input
              type="text"
              placeholder="Rechercher un employé (nom, matricule)..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </form>
          <select
            className="de-select"
            value={filtreCategorie}
            onChange={(e) => setFiltreCategorie(e.target.value)}
          >
            <option value="">Toutes les catégories</option>
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            className="de-select"
            value={filtreStatut}
            onChange={(e) => setFiltreStatut(e.target.value)}
          >
            <option value="">Tous les statuts</option>
            {DOCUMENT_STATUTS.map((s) => (
              <option key={s} value={s}>{DOCUMENT_STATUT_LABELS[s]}</option>
            ))}
          </select>
        </div>
        {!readOnly && (
          <button type="button" className="de-add-btn" onClick={openAdd}>
            <Plus size={16} aria-hidden="true" /> Ajouter un document
          </button>
        )}
      </div>

      {error ? (
        <div className="de-empty-state" style={{ color: '#dc2626' }}>{error}</div>
      ) : (
        <Table
          columns={columns}
          rows={documents}
          loading={loading}
          emptyText="Aucun document trouvé."
        />
      )}

      {meta && meta.total > 20 && (
        <div className="de-pagination">
          <button type="button" disabled={page <= 1} onClick={() => handlePage(page - 1)}>
            ← Précédent
          </button>
          <span>Page {meta.page} / {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => handlePage(page + 1)}>
            Suivant →
          </button>
        </div>
      )}

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Ajouter un document">
        <form onSubmit={onAddSubmit} className="de-form">
          <div className="de-emp-search">
            <FormField
              label="Employé"
              name="employe"
              value={empSearch}
              onChange={(e) => onEmpSearchChange(e.target.value)}
              error={formErrors.employe}
              placeholder="Nom ou matricule..."
            />
            {empSuggestions.length > 0 && (
              <ul className="de-emp-suggestions">
                {empSuggestions.map((emp) => (
                  <li key={emp.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setEmpSelection(emp)
                        setEmpSearch(`${emp.prenom} ${emp.nom} (${emp.matricule})`)
                        setEmpSuggestions([])
                      }}
                    >
                      {emp.prenom} {emp.nom} ({emp.matricule})
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="ff-field">
            <label className="ff-label">Fichier</label>
            <input
              type="file"
              accept={PIECES_ACCEPT}
              onChange={(e) => { setForm((p) => ({ ...p, fichier: e.target.files?.[0] ?? null })); setFormErrors((p) => ({ ...p, fichier: null })) }}
              className={`ff-input${formErrors.fichier ? ' ff-has-error' : ''}`}
            />
            {formErrors.fichier && <span className="ff-error">{formErrors.fichier}</span>}
          </div>

          <FormField
            label="Catégorie"
            name="categorie"
            value={form.categorie}
            onChange={onFormChange}
            type="select"
            options={DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: c }))}
            error={formErrors.categorie}
          />
          <FormField
            label="Description"
            name="description"
            value={form.description}
            onChange={onFormChange}
            error={formErrors.description}
          />
          <FormField
            label="Date d'expiration"
            name="date_expiration"
            value={form.date_expiration}
            onChange={onFormChange}
            type="date"
            error={formErrors.date_expiration}
          />
          <label className="de-obligatoire">
            <input
              type="checkbox"
              name="obligatoire"
              checked={form.obligatoire}
              onChange={onFormChange}
            />
            Document obligatoire
          </label>

          {formErrors.global && <div className="de-form-error">{formErrors.global}</div>}

          <div className="de-form-actions">
            <button type="button" className="de-cancel-btn" onClick={() => setAddOpen(false)} disabled={saving}>
              Annuler
            </button>
            <button type="submit" className="de-primary-btn" disabled={saving}>
              {saving ? 'Ajout...' : 'Ajouter'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Supprimer le document">
        <p>
          Confirmer la suppression de <strong>{deleteTarget?.nom_original}</strong>
          {deleteTarget?.employe && (
            <> de <strong>{deleteTarget.employe.prenom} {deleteTarget.employe.nom}</strong></>
          )} ?
        </p>
        {deleteError && <div className="de-form-error">{deleteError}</div>}
        <div className="de-form-actions">
          <button type="button" className="de-cancel-btn" onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Annuler
          </button>
          <button type="button" className="de-danger-btn" onClick={onDelete} disabled={deleting}>
            {deleting ? 'Suppression...' : 'Confirmer'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
