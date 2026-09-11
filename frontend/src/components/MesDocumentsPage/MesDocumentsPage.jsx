import { useEffect, useState } from 'react'
import { FileCheck2 } from 'lucide-react'
import api from '../../api'
import Table from '../ui/Table/Table'
import Badge from '../ui/Badge/Badge'
import { DOCUMENT_STATUT_LABELS, DOCUMENT_STATUT_VARIANTS } from '../../constants/documentsEmployes'
import { telechargerPieceJointe } from '../../utils/telechargerPieceJointe'
import './MesDocumentsPage.css'

const formatDate = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('fr-FR')
}

export default function MesDocumentsPage() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    api.get('/moi/pieces-jointes')
      .then(({ data }) => {
        if (cancelled) return
        setDocuments(Array.isArray(data) ? data : [])
        setError(null)
      })
      .catch(() => { if (!cancelled) setError('Impossible de charger vos documents.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const columns = [
    {
      key: 'nom_original',
      label: 'Document',
      render: (v, row) => (
        <div>
          <div className="md-file-name">{v ?? '—'}</div>
          {row.extension && <div className="md-file-meta">.{row.extension}</div>}
        </div>
      ),
    },
    { key: 'categorie', label: 'Catégorie', render: (v) => v ?? '—' },
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
        <button
          type="button"
          className="md-link-btn"
          onClick={() => telechargerPieceJointe(row)}
        >
          Télécharger
        </button>
      ),
    },
  ]

  return (
    <div className="md-container">
      <div className="md-page-header">
        <p className="md-page-subtitle">Mon profil</p>
        <h2 className="md-title">
          <FileCheck2 size={24} aria-hidden="true" /> Mes documents
        </h2>
      </div>

      {error ? (
        <div className="md-empty-state" style={{ color: '#dc2626' }}>{error}</div>
      ) : (
        <Table
          columns={columns}
          rows={documents}
          loading={loading}
          emptyText="Aucun document disponible."
        />
      )}
    </div>
  )
}
