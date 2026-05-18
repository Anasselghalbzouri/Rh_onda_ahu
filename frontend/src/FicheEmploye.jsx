import { useEffect, useState } from 'react'
import api from './api'

const STATUT_STYLE = {
  actif:    { background: '#d1fae5', color: '#065f46' },
  mute:     { background: '#dbeafe', color: '#1e40af' },
  retraite: { background: '#f3f4f6', color: '#374151' },
  parti:    { background: '#fee2e2', color: '#991b1b' },
  suspendu: { background: '#fef3c7', color: '#92400e' },
}

const DOSSIER_STATUT_STYLE = {
  valide:       { background: '#d1fae5', color: '#065f46' },
  expire:       { background: '#fee2e2', color: '#991b1b' },
  a_renouveler: { background: '#fef3c7', color: '#92400e' },
}

const PIECES_ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx'

export default function FicheEmploye({ id, onRetour }) {
  const [employe, setEmploye] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const [piecesJointes, setPiecesJointes] = useState([])
  const [piecesLoading, setPiecesLoading] = useState(true)
  const [piecesError, setPiecesError] = useState(null)

  const [uploadFile, setUploadFile] = useState(null)
  const [uploadCategorie, setUploadCategorie] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [fileInputKey, setFileInputKey] = useState(0)

  useEffect(() => {
    api.get(`/employes/${id}`)
      .then(({ data }) => {
        setEmploye(data)
        setError(null)
      })
      .catch(() => setError('Impossible de charger la fiche.'))
      .finally(() => setLoading(false))
  }, [id])

  const fetchPiecesJointes = () => {
    setPiecesLoading(true)
    setPiecesError(null)
    return api.get(`/employes/${id}/pieces-jointes`)
      .then(({ data }) => setPiecesJointes(Array.isArray(data) ? data : []))
      .catch(() => setPiecesError('Impossible de charger les pièces jointes.'))
      .finally(() => setPiecesLoading(false))
  }

  useEffect(() => {
    let cancelled = false
    api.get(`/employes/${id}/pieces-jointes`)
      .then(({ data }) => {
        if (cancelled) return
        setPiecesJointes(Array.isArray(data) ? data : [])
        setPiecesError(null)
      })
      .catch(() => { if (!cancelled) setPiecesError('Impossible de charger les pièces jointes.') })
      .finally(() => { if (!cancelled) setPiecesLoading(false) })
    return () => { cancelled = true }
  }, [id])

  if (loading) return <p style={styles.center}>Chargement...</p>
  if (error)   return <p style={{ ...styles.center, color: '#dc2626' }}>{error}</p>
  if (!employe) return null

  const statutStyle = STATUT_STYLE[employe.statut] ?? { background: '#f3f4f6', color: '#374151' }

  const formatDate = (value) => {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString('fr-FR')
  }

  const dossierPersonnel = Array.isArray(employe.dossier_personnel) ? employe.dossier_personnel : []
  const historiqueProfessionnel = (Array.isArray(employe.historique_professionnel) ? employe.historique_professionnel : [])
    .slice()
    .sort((a, b) => {
      const da = new Date(a?.date_debut ?? 0).getTime()
      const db = new Date(b?.date_debut ?? 0).getTime()
      return db - da
    })

  const onDeletePieceJointe = async (pieceId) => {
    if (!pieceId) return
    try {
      await api.delete(`/pieces-jointes/${pieceId}`)
      await fetchPiecesJointes()
    } catch {
      setPiecesError('Impossible de supprimer la pièce jointe.')
    }
  }

  const onUploadPieceJointe = async (e) => {
    e.preventDefault()
    setUploadError(null)
    if (!uploadFile) {
      setUploadError('Veuillez sélectionner un fichier.')
      return
    }
    try {
      setUploading(true)
      const form = new FormData()
      form.append('fichier', uploadFile)
      form.append('categorie', uploadCategorie)
      await api.post(`/employes/${id}/pieces-jointes`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setUploadFile(null)
      setUploadCategorie('')
      setFileInputKey((k) => k + 1)
      await fetchPiecesJointes()
    } catch {
      setUploadError("Impossible d'ajouter la pièce jointe.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={styles.container}>

      {/* ── HEADER ── */}
      <div style={styles.header}>
        <button style={styles.retourBtn} onClick={onRetour}>← Retour</button>
        <div style={styles.headerInfo}>
          <h2 style={styles.nomComplet}>{employe.prenom} {employe.nom}</h2>
          <span style={styles.matriculeBadge}>Matricule : {employe.matricule}</span>
        </div>
        <span style={{ ...styles.statutBadge, ...statutStyle }}>
          {employe.statut ?? '—'}
        </span>
      </div>

      {/* ── INFOS GÉNÉRALES ── */}
      <Section titre="Informations générales">
        <Grid>
          <Info label="Sexe"           value={employe.sexe === 'M' ? 'Masculin' : employe.sexe === 'F' ? 'Féminin' : '—'} />
          <Info label="Date naissance" value={formatDate(employe.date_naissance)} />
          <Info label="Date embauche"  value={formatDate(employe.date_embauche)} />
          <Info label="Catégorie"      value={employe.categorie ?? '—'} />
          <Info label="Échelle"        value={employe.echelle ?? '—'} />
          <Info label="Échelon"        value={employe.echelon ?? '—'} />
          <Info label="Fonction"       value={employe.fonction ?? '—'} />
          <Info label="Qualification"  value={employe.qualification ?? '—'} />
          <Info label="Service"        value={employe.service?.nom ?? '—'} />
          <Info label="Entité"         value={employe.entite ?? '—'} />
          <Info label="Affectation"    value={employe.affectation ?? '—'} />
          <Info label="Mutation"       value={employe.mutation ?? '—'} />
        </Grid>
        {employe.observation && (
          <div style={styles.observation}>
            <strong>Observation :</strong> {employe.observation}
          </div>
        )}
      </Section>

      {/* ── SOLDE CONGÉ ── */}
      <Section titre="Solde congé">
        <div style={styles.soldeCard}>
          <span style={styles.soldeNumber}>{employe.solde_conge ?? 0}</span>
          <span style={styles.soldeLabel}>jours restants</span>
        </div>
      </Section>

      {/* Sections 4-6 à compléter par Codex */}
      <Section titre="Dossier personnel">
        {dossierPersonnel.length === 0 ? (
          <div style={styles.emptyState}>Aucun document enregistré.</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Numéro</th>
                  <th style={styles.th}>Date délivrance</th>
                  <th style={styles.th}>Date expiration</th>
                  <th style={styles.th}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {dossierPersonnel.map((doc, idx) => {
                  const badgeStyle = DOSSIER_STATUT_STYLE[doc?.statut] ?? { background: '#f3f4f6', color: '#374151' }
                  const statutLabel = doc?.statut === 'a_renouveler'
                    ? 'À renouveler'
                    : (doc?.statut ?? '—')
                  return (
                    <tr key={doc?.id ?? `${doc?.type_piece ?? 'doc'}-${idx}`}>
                      <td style={styles.td}>{doc?.type_piece ?? '—'}</td>
                      <td style={styles.td}>{doc?.numero_piece ?? '—'}</td>
                      <td style={styles.td}>{formatDate(doc?.date_delivrance)}</td>
                      <td style={styles.td}>{formatDate(doc?.date_expiration)}</td>
                      <td style={styles.td}>
                        <span style={{ ...styles.badge, ...badgeStyle }}>{statutLabel}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section titre="Historique professionnel">
        {historiqueProfessionnel.length === 0 ? (
          <div style={styles.emptyState}>Aucun historique enregistré.</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Poste</th>
                  <th style={styles.th}>Service</th>
                  <th style={styles.th}>Période</th>
                  <th style={styles.th}>Observation</th>
                </tr>
              </thead>
              <tbody>
                {historiqueProfessionnel.map((h, idx) => (
                  <tr key={h?.id ?? `${h?.poste ?? 'hist'}-${idx}`}>
                    <td style={styles.td}>{h?.poste ?? '—'}</td>
                    <td style={styles.td}>{h?.service?.nom ?? '—'}</td>
                    <td style={styles.td}>
                      {formatDate(h?.date_debut)} → {h?.date_fin ? formatDate(h?.date_fin) : 'En cours'}
                    </td>
                    <td style={styles.td}>{h?.observation ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section titre="Pièces jointes">
        {piecesLoading ? (
          <div style={styles.emptyState}>Chargement...</div>
        ) : piecesError ? (
          <div style={{ ...styles.emptyState, color: '#dc2626' }}>{piecesError}</div>
        ) : piecesJointes.length === 0 ? (
          <div style={styles.emptyState}>Aucune pièce jointe.</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Nom fichier</th>
                  <th style={styles.th}>Catégorie</th>
                  <th style={styles.th}>Taille</th>
                  <th style={styles.th}>Date upload</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {piecesJointes.map((p) => (
                  <tr key={p.id}>
                    <td style={styles.td}>
                      <div style={styles.fileName}>{p.nom_original ?? '—'}</div>
                      {p.extension && <div style={styles.fileMeta}>.{p.extension}</div>}
                    </td>
                    <td style={styles.td}>{p.categorie ?? '—'}</td>
                    <td style={styles.td}>{p.taille ?? '—'}</td>
                    <td style={styles.td}>{formatDate(p.date_upload)}</td>
                    <td style={styles.td}>
                      <div style={styles.actions}>
                        <button
                          type="button"
                          style={styles.linkBtn}
                          onClick={() => { if (p.url) window.open(p.url, '_blank', 'noopener,noreferrer') }}
                        >
                          Télécharger
                        </button>
                        <button
                          type="button"
                          style={styles.deleteBtn}
                          onClick={() => onDeletePieceJointe(p.id)}
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form onSubmit={onUploadPieceJointe} style={styles.uploadForm}>
          <div style={styles.uploadGrid}>
            <input
              type="file"
              accept={PIECES_ACCEPT}
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              key={fileInputKey}
              style={styles.fileInput}
            />
            <input
              type="text"
              placeholder="Catégorie (optionnel)"
              value={uploadCategorie}
              onChange={(e) => setUploadCategorie(e.target.value)}
              style={styles.textInput}
            />
            <button type="submit" style={{ ...styles.primaryBtn, opacity: uploading ? 0.7 : 1 }} disabled={uploading}>
              {uploading ? 'Ajout...' : 'Ajouter'}
            </button>
          </div>
          {uploadError && <div style={styles.formError}>{uploadError}</div>}
        </form>
      </Section>

    </div>
  )
}

function Section({ titre, children }) {
  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>{titre}</h3>
      {children}
    </div>
  )
}

function Grid({ children }) {
  return <div style={styles.grid}>{children}</div>
}

function Info({ label, value }) {
  return (
    <div style={styles.infoItem}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={styles.infoValue}>{value}</span>
    </div>
  )
}

const styles = {
  container: { maxWidth: '960px', margin: '0 auto', padding: '1.5rem' },
  center: { textAlign: 'center', padding: '3rem', color: '#6b7280' },

  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.2rem',
    background: '#1a3c5e',
    color: '#fff',
    padding: '1.2rem 1.5rem',
    borderRadius: '10px',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
  },
  retourBtn: {
    background: 'rgba(255,255,255,0.15)',
    color: '#fff',
    border: 'none',
    padding: '0.4rem 1rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.875rem',
    whiteSpace: 'nowrap',
  },
  headerInfo: { flex: 1 },
  nomComplet: { margin: 0, fontSize: '1.3rem', fontWeight: 700 },
  matriculeBadge: {
    fontSize: '0.85rem',
    background: 'rgba(255,255,255,0.15)',
    padding: '0.2rem 0.7rem',
    borderRadius: '20px',
    marginTop: '0.3rem',
    display: 'inline-block',
  },
  statutBadge: {
    padding: '0.3rem 0.9rem',
    borderRadius: '20px',
    fontWeight: 700,
    fontSize: '0.85rem',
    whiteSpace: 'nowrap',
  },

  section: {
    background: '#fff',
    borderRadius: '10px',
    padding: '1.2rem 1.5rem',
    marginBottom: '1.2rem',
    boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
  },
  sectionTitle: {
    margin: '0 0 1rem 0',
    fontSize: '1rem',
    fontWeight: 700,
    color: '#1a3c5e',
    borderBottom: '2px solid #e5e7eb',
    paddingBottom: '0.5rem',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '0.8rem',
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
  },
  infoLabel: { fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' },
  infoValue: { fontSize: '0.9rem', color: '#111827' },

  observation: {
    marginTop: '1rem',
    padding: '0.7rem 1rem',
    background: '#fef3c7',
    borderRadius: '6px',
    fontSize: '0.9rem',
    color: '#92400e',
  },

  soldeCard: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.5rem',
  },
  soldeNumber: {
    fontSize: '2.5rem',
    fontWeight: 800,
    color: '#1a3c5e',
  },
  soldeLabel: {
    fontSize: '1rem',
    color: '#6b7280',
  },

  emptyState: {
    padding: '0.75rem 0.9rem',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    color: '#6b7280',
    fontSize: '0.9rem',
  },

  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    padding: '0.65rem 0.75rem',
    background: '#1a3c5e',
    color: '#fff',
    fontSize: '0.85rem',
    fontWeight: 700,
  },
  td: {
    padding: '0.65rem 0.75rem',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '0.9rem',
    color: '#111827',
    verticalAlign: 'top',
  },
  badge: {
    display: 'inline-block',
    padding: '0.2rem 0.6rem',
    borderRadius: '999px',
    fontSize: '0.8rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },

  actions: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  linkBtn: {
    background: 'rgba(26,60,94,0.08)',
    color: '#1a3c5e',
    border: '1px solid rgba(26,60,94,0.25)',
    padding: '0.35rem 0.65rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '0.85rem',
    whiteSpace: 'nowrap',
  },
  deleteBtn: {
    background: '#fee2e2',
    color: '#991b1b',
    border: '1px solid rgba(153,27,27,0.25)',
    padding: '0.35rem 0.65rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '0.85rem',
    whiteSpace: 'nowrap',
  },

  uploadForm: {
    marginTop: '1rem',
    paddingTop: '1rem',
    borderTop: '1px solid #e5e7eb',
  },
  uploadGrid: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 1fr auto',
    gap: '0.7rem',
    alignItems: 'center',
  },
  fileInput: {
    width: '100%',
    padding: '0.55rem 0.65rem',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    background: '#fff',
    fontSize: '0.9rem',
  },
  textInput: {
    width: '100%',
    padding: '0.55rem 0.65rem',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    background: '#fff',
    fontSize: '0.9rem',
  },
  primaryBtn: {
    background: '#1a3c5e',
    color: '#fff',
    border: 'none',
    padding: '0.55rem 1rem',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: '0.9rem',
    whiteSpace: 'nowrap',
  },
  formError: {
    marginTop: '0.7rem',
    color: '#dc2626',
    fontSize: '0.9rem',
    fontWeight: 600,
  },
  fileName: { fontWeight: 700 },
  fileMeta: { fontSize: '0.8rem', color: '#6b7280' },
}
