/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Briefcase, CalendarDays, FileCheck2, GraduationCap, History, Paperclip, UserRound } from 'lucide-react'
import api from '../../api'
import FormField from '../ui/FormField/FormField'
import Badge from '../ui/Badge/Badge'
import { DOCUMENT_CATEGORIES, DOCUMENT_STATUT_LABELS, DOCUMENT_STATUT_VARIANTS } from '../../constants/documentsEmployes'
import { telechargerPieceJointe } from '../../utils/telechargerPieceJointe'
import './FicheEmploye.css'

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

const STATUTS = ['actif', 'mute', 'retraite', 'parti', 'suspendu']
const TYPE_CONGE_LABELS = {
  annuel: 'Annuel',
  maladie: 'Maladie',
  maternite: 'Maternité',
  sans_solde: 'Sans solde',
  exceptionnel: 'Exceptionnel',
}
const CONGE_STATUT_LABELS = {
  en_attente: 'En attente',
  approuve: 'Approuvé',
  refuse: 'Refusé',
}
const TABS = [
  { key: 'profil', label: 'Profil', icon: UserRound },
  { key: 'conges', label: 'Congés', icon: CalendarDays },
  { key: 'formations', label: 'Formations', icon: GraduationCap },
  { key: 'documents', label: 'Documents', icon: FileCheck2 },
  { key: 'historique', label: 'Historique', icon: History },
  { key: 'observations', label: 'Observations', icon: Briefcase },
]

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('fr-FR')
}

const congeFileUrl = (congeId) => {
  const base = (api.defaults.baseURL ?? '').replace(/\/$/, '')
  return `${base}/conges/${congeId}/fichier`
}


export default function FicheEmploye({ id, onRetour }) {
  const navigate = useNavigate()
  const [employe, setEmploye] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [piecesJointes, setPiecesJointes] = useState([])
  const [piecesLoading, setPiecesLoading] = useState(true)
  const [piecesError, setPiecesError] = useState(null)

  const [uploadFile, setUploadFile] = useState(null)
  const [uploadCategorie, setUploadCategorie] = useState('')
  const [uploadDateExpiration, setUploadDateExpiration] = useState('')
  const [uploadObligatoire, setUploadObligatoire] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [fileInputKey, setFileInputKey] = useState(0)

  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState(null)
  const [editSuccess, setEditSuccess] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState('profil')
  const [dragActive, setDragActive] = useState(false)
  const [formationsEmploye, setFormationsEmploye] = useState([])
  const [formationsLoading, setFormationsLoading] = useState(false)
  const [formationsError, setFormationsError] = useState(null)

  const fetchEmploye = () => {
    return api.get(`/employes/${id}`)
      .then(({ data }) => { setEmploye(data); setError(null) })
      .catch(() => setError('Impossible de charger la fiche.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchEmploye() }, [id])

  const openEdit = () => {
    setEditForm({
      nom:            employe.nom ?? '',
      prenom:         employe.prenom ?? '',
      sexe:           employe.sexe ?? '',
      date_naissance: employe.date_naissance?.slice(0, 10) ?? '',
      date_embauche:  employe.date_embauche?.slice(0, 10) ?? '',
      categorie:      employe.categorie ?? '',
      echelle:        employe.echelle ?? '',
      echelon:        employe.echelon ?? '',
      entite:         employe.entite ?? '',
      fonction:       employe.fonction ?? '',
      qualification:  employe.qualification ?? '',
      affectation:    employe.affectation ?? '',
      solde_conge:    employe.solde_conge ?? '',
      statut:         employe.statut ?? '',
      observation:    employe.observation ?? '',
    })
    setEditError(null)
    setEditSuccess(false)
    setEditOpen(true)
  }

  const onEditChange = (e) => {
    const { name, value } = e.target
    setEditForm((prev) => ({ ...prev, [name]: value }))
  }

  const onDelete = async () => {
    setDeleteError(null)
    setDeleting(true)
    try {
      await api.delete(`/employes/${id}`)
      onRetour()
    } catch {
      setDeleteError("Impossible de supprimer l'employé.")
      setDeleting(false)
    }
  }

  const onEditSubmit = async (e) => {
    e.preventDefault()
    setEditError(null)
    setEditSaving(true)
    try {
      const { data } = await api.put(`/employes/${id}`, editForm)
      setEmploye(data)
      setEditSuccess(true)
      setTimeout(() => { setEditOpen(false); setEditSuccess(false) }, 1500)
    } catch (err) {
      const msgs = err.response?.data?.errors
      if (msgs) {
        setEditError(Object.values(msgs).flat().join(' — '))
      } else {
        setEditError('Impossible de sauvegarder les modifications.')
      }
    } finally {
      setEditSaving(false)
    }
  }

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

  useEffect(() => {
    if (activeTab !== 'formations') return
    let cancelled = false
    setFormationsLoading(true)
    setFormationsError(null)
    api.get(`/employes/${id}/formations`)
      .then(({ data }) => {
        if (cancelled) return
        setFormationsEmploye(Array.isArray(data) ? data : data?.data ?? [])
      })
      .catch(() => { if (!cancelled) setFormationsError('Impossible de charger les formations.') })
      .finally(() => { if (!cancelled) setFormationsLoading(false) })
    return () => { cancelled = true }
  }, [activeTab, id])

  if (loading) return <p className="fiche-center">Chargement...</p>
  if (error)   return <p className="fiche-center" style={{ color: '#dc2626' }}>{error}</p>
  if (!employe) return null

  const statutStyle = STATUT_STYLE[employe.statut] ?? { background: '#f3f4f6', color: '#374151' }

  const dossierPersonnel = Array.isArray(employe.dossier_personnel) ? employe.dossier_personnel : []
  const historiqueProfessionnel = (Array.isArray(employe.historique_professionnel) ? employe.historique_professionnel : [])
    .slice()
    .sort((a, b) => new Date(b?.date_debut ?? 0) - new Date(a?.date_debut ?? 0))
  const demandesConge = (Array.isArray(employe.demandes_conge) ? employe.demandes_conge : [])
    .slice()
    .sort((a, b) => new Date(b?.date_debut ?? 0) - new Date(a?.date_debut ?? 0))
  const congesAvecFichier = demandesConge.filter((conge) => conge?.fichier_nom)
  const dossierTotal = dossierPersonnel.length
  const dossierValides = dossierPersonnel.filter((doc) => doc?.statut === 'valide').length
  const dossierCompleteness = dossierTotal > 0 ? Math.round((dossierValides / dossierTotal) * 100) : 0
  const dossierAlerts = dossierPersonnel.filter((doc) => ['expire', 'a_renouveler'].includes(doc?.statut)).length

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
      if (uploadDateExpiration) form.append('date_expiration', uploadDateExpiration)
      form.append('obligatoire', uploadObligatoire ? '1' : '0')
      await api.post(`/employes/${id}/pieces-jointes`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setUploadFile(null)
      setUploadCategorie('')
      setUploadDateExpiration('')
      setUploadObligatoire(false)
      setFileInputKey((k) => k + 1)
      await fetchPiecesJointes()
    } catch {
      setUploadError("Impossible d'ajouter la pièce jointe.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fiche-container">

      <div className="fiche-header">
        <button className="fiche-retour-btn" onClick={onRetour}>← Retour</button>
        <div className="fiche-header-info">
          <h2 className="fiche-nom-complet">{employe.prenom} {employe.nom}</h2>
          <span className="fiche-matricule-badge">Matricule : {employe.matricule}</span>
        </div>
        <span className="fiche-statut-badge" style={statutStyle}>
          {employe.statut ?? '—'}
        </span>
        <button className="fiche-edit-btn" onClick={openEdit}>Modifier</button>
        <button className="fiche-del-btn" onClick={() => { setDeleteConfirm(true); setDeleteError(null) }}>
          Supprimer
        </button>
      </div>

      {deleteConfirm && (
        <div className="fiche-overlay" onClick={() => setDeleteConfirm(false)}>
          <div className="fiche-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Supprimer l'employé</h3>
            <p>
              Confirmer la suppression de <strong>{employe.prenom} {employe.nom}</strong> ?
              Cette action est irréversible.
            </p>
            {deleteError && <div className="fiche-form-error">{deleteError}</div>}
            <div className="fiche-confirm-actions">
              <button className="fiche-cancel-btn" onClick={() => setDeleteConfirm(false)} disabled={deleting}>
                Annuler
              </button>
              <button className="fiche-danger-btn" onClick={onDelete} disabled={deleting}>
                {deleting ? 'Suppression...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fiche-summary-card">
        <div className="fiche-summary-main">
          <span className="fiche-summary-avatar">{`${employe.prenom?.[0] ?? ''}${employe.nom?.[0] ?? ''}`.toUpperCase()}</span>
          <div>
            <h3>{employe.prenom} {employe.nom}</h3>
            <p>{employe.fonction ?? 'Fonction non renseignée'} · {employe.service?.nom ?? 'Service non renseigné'}</p>
          </div>
        </div>
        <div className="fiche-summary-metrics">
          <Metric label="Solde congé" value={`${employe.solde_conge ?? 0}j`} tone={Number(employe.solde_conge ?? 0) < 5 ? 'danger' : 'success'} />
          <Metric label="Dossier complet" value={`${dossierCompleteness}%`} tone={dossierCompleteness < 80 ? 'warning' : 'success'} />
          <Metric label="Alertes" value={dossierAlerts} tone={dossierAlerts > 0 ? 'danger' : 'success'} />
        </div>
      </div>

      <div className="fiche-tabs" role="tablist" aria-label="Sections de la fiche employé">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={activeTab === tab.key ? 'active' : ''}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon size={15} aria-hidden="true" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'profil' && (
        <>
      <Section titre="Informations générales">
        <div className="fiche-grid">
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
        </div>
        {employe.observation && (
          <div className="fiche-observation">
            <strong>Observation :</strong> {employe.observation}
          </div>
        )}
      </Section>

      <Section titre="Solde congé">
        <div className="fiche-solde-card">
          <span className="fiche-solde-number">{employe.solde_conge ?? 0}</span>
          <span className="fiche-solde-label">jours restants</span>
        </div>
      </Section>
        </>
      )}

      {activeTab === 'conges' && (
        <Section titre="Congés de l'employé">
          {demandesConge.length === 0 ? (
            <div className="fiche-empty-state">Aucun congé enregistré pour cet employé.</div>
          ) : (
            <div className="fiche-table-wrap">
              <table className="fiche-table">
                <thead>
                  <tr>
                    <th className="fiche-th">Type</th>
                    <th className="fiche-th">Période</th>
                    <th className="fiche-th">Jours</th>
                    <th className="fiche-th">Solde restant</th>
                    <th className="fiche-th">Statut</th>
                    <th className="fiche-th">Références</th>
                    <th className="fiche-th">Document</th>
                  </tr>
                </thead>
                <tbody>
                  {demandesConge.map((conge) => (
                    <tr key={conge.id}>
                      <td className="fiche-td">
                        <span className="fiche-conge-type">{TYPE_CONGE_LABELS[conge.type_conge] ?? conge.type_conge ?? '—'}</span>
                      </td>
                      <td className="fiche-td">{formatDate(conge.date_debut)} → {formatDate(conge.date_fin)}</td>
                      <td className="fiche-td"><strong>{conge.nombre_jours ?? 0}j</strong></td>
                      <td className="fiche-td">{conge.solde_restant != null ? `${conge.solde_restant}j` : '—'}</td>
                      <td className="fiche-td">
                        <span className={`fiche-conge-statut statut-${conge.statut}`}>
                          {CONGE_STATUT_LABELS[conge.statut] ?? conge.statut ?? '—'}
                        </span>
                      </td>
                      <td className="fiche-td">
                        <div className="fiche-conge-refs">
                          <span>HR: {conge.ref_hraccess || '—'}</span>
                          <span>ONDA: {conge.ref_onda_ahu || '—'}</span>
                        </div>
                      </td>
                      <td className="fiche-td">
                        {conge.fichier_nom ? (
                          <button
                            type="button"
                            className="fiche-link-btn"
                            onClick={() => window.open(congeFileUrl(conge.id), '_blank', 'noopener,noreferrer')}
                            title={conge.fichier_nom}
                          >
                            Télécharger
                          </button>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {activeTab === 'formations' && (
        <Section titre="Formations de l'employe">
          <div className="fiche-section-actions">
            <button
              type="button"
              className="fiche-primary-btn"
              onClick={() => navigate('/formations', {
                state: {
                  employeId: id,
                  employeName: `${employe.prenom ?? ''} ${employe.nom ?? ''}`.trim(),
                },
              })}
            >
              Inscrire a une formation
            </button>
          </div>

          {formationsLoading ? (
            <div className="fiche-empty-state">Chargement...</div>
          ) : formationsError ? (
            <div className="fiche-empty-state" style={{ color: '#dc2626' }}>{formationsError}</div>
          ) : (() => {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const planifiees = formationsEmploye.filter(f => new Date(f.date_debut) > today)
            const passees    = formationsEmploye.filter(f => new Date(f.date_debut) <= today)
            return (
              <>
                <div className="fiche-formation-sub-title">
                  Formations planifiées
                  <span className="fiche-formation-sub-count">{planifiees.length}</span>
                </div>
                {planifiees.length === 0 ? (
                  <div className="fiche-empty-state fiche-empty-sm">Aucune formation planifiée.</div>
                ) : (
                  <div className="fiche-planifiees-grid">
                    {planifiees.map((f) => (
                      <div key={f.id} className="fiche-planifiee-card">
                        <div className="fiche-planifiee-header">
                          <span className="fiche-formation-name-badge">{f.intitule ?? 'Formation'}</span>
                          <span className={`fiche-formation-type type-${f.type}`}>
                            {f.type === 'externe' ? 'Externe' : 'Interne'}
                          </span>
                        </div>
                        {(f.plan_formation?.titre ?? f.planFormation?.titre) && (
                          <div className="fiche-planifiee-plan">
                            <span className="fiche-planifiee-plan-label">Plan</span>
                            {f.plan_formation?.titre ?? f.planFormation?.titre}
                          </div>
                        )}
                        {f.organisme && (
                          <div className="fiche-planifiee-org">{f.organisme}</div>
                        )}
                        <div className="fiche-planifiee-meta">
                          <span>📅 {formatDate(f.date_debut)} → {formatDate(f.date_fin)}</span>
                          {f.lieu && <span>📍 {f.lieu}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="fiche-formation-sub-title" style={{ marginTop: '20px' }}>
                  Historique
                  <span className="fiche-formation-sub-count">{passees.length}</span>
                </div>
                {passees.length === 0 ? (
                  <div className="fiche-empty-state fiche-empty-sm">Aucune formation passée.</div>
                ) : (
                  <div className="fiche-table-wrap">
                    <table className="fiche-table">
                      <thead>
                        <tr>
                          <th className="fiche-th">Formation</th>
                          <th className="fiche-th">Type</th>
                          <th className="fiche-th">Période</th>
                          <th className="fiche-th">Lieu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {passees.map((formation) => (
                          <tr key={formation.id}>
                            <td className="fiche-td">
                              <span className="fiche-formation-name-badge">
                                {formation.intitule ?? 'Formation'}
                              </span>
                              <div className="fiche-file-meta">{formation.organisme ?? formation.plan_formation?.titre ?? formation.planFormation?.titre ?? ''}</div>
                            </td>
                            <td className="fiche-td">
                              <span className={`fiche-formation-type type-${formation.type}`}>
                                {formation.type === 'externe' ? 'Externe' : 'Interne'}
                              </span>
                            </td>
                            <td className="fiche-td">{formatDate(formation.date_debut)} → {formatDate(formation.date_fin)}</td>
                            <td className="fiche-td">{formation.lieu ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )
          })()}
        </Section>
      )}

      {activeTab === 'documents' && (
        <>
      <Section titre="Dossier personnel">
        {dossierAlerts > 0 && (
          <div className="fiche-alert">
            <AlertTriangle size={16} aria-hidden="true" />
            {dossierAlerts} document(s) expiré(s) ou à renouveler.
          </div>
        )}
        {dossierPersonnel.length === 0 ? (
          <div className="fiche-empty-state">Aucun document enregistré.</div>
        ) : (
          <div className="fiche-table-wrap">
            <table className="fiche-table">
              <thead>
                <tr>
                  <th className="fiche-th">Type</th>
                  <th className="fiche-th">Numéro</th>
                  <th className="fiche-th">Date délivrance</th>
                  <th className="fiche-th">Date expiration</th>
                  <th className="fiche-th">Statut</th>
                </tr>
              </thead>
              <tbody>
                {dossierPersonnel.map((doc, idx) => {
                  const badgeStyle = DOSSIER_STATUT_STYLE[doc?.statut] ?? { background: '#f3f4f6', color: '#374151' }
                  const statutLabel = doc?.statut === 'a_renouveler' ? 'À renouveler' : (doc?.statut ?? '—')
                  return (
                    <tr key={doc?.id ?? `${doc?.type_piece ?? 'doc'}-${idx}`}>
                      <td className="fiche-td">{doc?.type_piece ?? '—'}</td>
                      <td className="fiche-td">{doc?.numero_piece ?? '—'}</td>
                      <td className="fiche-td">{formatDate(doc?.date_delivrance)}</td>
                      <td className="fiche-td">{formatDate(doc?.date_expiration)}</td>
                      <td className="fiche-td">
                        <span className="fiche-badge" style={badgeStyle}>{statutLabel}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section titre="Pièces jointes">
        {piecesLoading ? (
          <div className="fiche-empty-state">Chargement...</div>
        ) : piecesError ? (
          <div className="fiche-empty-state" style={{ color: '#dc2626' }}>{piecesError}</div>
        ) : piecesJointes.length === 0 ? (
          <div className="fiche-empty-state">Aucune pièce jointe.</div>
        ) : (
          <div className="fiche-table-wrap">
            <table className="fiche-table">
              <thead>
                <tr>
                  <th className="fiche-th">Nom fichier</th>
                  <th className="fiche-th">Catégorie</th>
                  <th className="fiche-th">Statut</th>
                  <th className="fiche-th">Date expiration</th>
                  <th className="fiche-th">Taille</th>
                  <th className="fiche-th">Date upload</th>
                  <th className="fiche-th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {piecesJointes.map((p) => (
                  <tr key={p.id}>
                    <td className="fiche-td">
                      <div className="fiche-file-name">{p.nom_original ?? '—'}</div>
                      {p.extension && <div className="fiche-file-meta">.{p.extension}</div>}
                    </td>
                    <td className="fiche-td">{p.categorie ?? '—'}</td>
                    <td className="fiche-td">
                      <Badge variant={DOCUMENT_STATUT_VARIANTS[p.statut] ?? 'default'}>
                        {DOCUMENT_STATUT_LABELS[p.statut] ?? p.statut ?? '—'}
                      </Badge>
                    </td>
                    <td className="fiche-td">{formatDate(p.date_expiration)}</td>
                    <td className="fiche-td">{p.taille ?? '—'}</td>
                    <td className="fiche-td">{formatDate(p.date_upload)}</td>
                    <td className="fiche-td">
                      <div className="fiche-actions">
                        <button
                          type="button"
                          className="fiche-link-btn"
                          onClick={() => telechargerPieceJointe(p)}
                        >
                          Télécharger
                        </button>
                        <button
                          type="button"
                          className="fiche-delete-btn"
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

        <form onSubmit={onUploadPieceJointe} className="fiche-upload-form">
          <div
            className={dragActive ? 'fiche-drop-zone active' : 'fiche-drop-zone'}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragActive(false)
              setUploadFile(e.dataTransfer.files?.[0] ?? null)
            }}
          >
            <Paperclip size={18} aria-hidden="true" />
            <span>{uploadFile ? uploadFile.name : 'Glisser-déposer une pièce jointe ou choisir un fichier'}</span>
            <input
              type="file"
              accept={PIECES_ACCEPT}
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              key={fileInputKey}
              className="fiche-file-input"
            />
          </div>
          <div className="fiche-upload-grid">
            <select
              value={uploadCategorie}
              onChange={(e) => setUploadCategorie(e.target.value)}
              className="fiche-text-input"
            >
              <option value="">Catégorie (optionnel)</option>
              {DOCUMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              type="date"
              value={uploadDateExpiration}
              onChange={(e) => setUploadDateExpiration(e.target.value)}
              className="fiche-text-input"
              title="Date d'expiration (optionnel)"
            />
            <label className="fiche-upload-obligatoire">
              <input
                type="checkbox"
                checked={uploadObligatoire}
                onChange={(e) => setUploadObligatoire(e.target.checked)}
              />
              Obligatoire
            </label>
            <button type="submit" className="fiche-primary-btn" disabled={uploading}>
              {uploading ? 'Ajout...' : 'Ajouter'}
            </button>
          </div>
          {uploadError && <div className="fiche-form-error">{uploadError}</div>}
        </form>
      </Section>

      <Section titre="Documents des congés">
        {congesAvecFichier.length === 0 ? (
          <div className="fiche-empty-state">Aucun document de congé attaché.</div>
        ) : (
          <div className="fiche-table-wrap">
            <table className="fiche-table">
              <thead>
                <tr>
                  <th className="fiche-th">Congé</th>
                  <th className="fiche-th">Période</th>
                  <th className="fiche-th">Fichier</th>
                  <th className="fiche-th">Action</th>
                </tr>
              </thead>
              <tbody>
                {congesAvecFichier.map((conge) => (
                  <tr key={`conge-file-${conge.id}`}>
                    <td className="fiche-td">{TYPE_CONGE_LABELS[conge.type_conge] ?? conge.type_conge ?? '—'}</td>
                    <td className="fiche-td">{formatDate(conge.date_debut)} → {formatDate(conge.date_fin)}</td>
                    <td className="fiche-td">
                      <div className="fiche-file-name">{conge.fichier_nom}</div>
                    </td>
                    <td className="fiche-td">
                      <button
                        type="button"
                        className="fiche-link-btn"
                        onClick={() => window.open(congeFileUrl(conge.id), '_blank', 'noopener,noreferrer')}
                      >
                        Télécharger
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
        </>
      )}

      {activeTab === 'historique' && (
      <Section titre="Historique professionnel">
        {historiqueProfessionnel.length === 0 ? (
          <div className="fiche-empty-state">Aucun historique enregistré.</div>
        ) : (
          <div className="fiche-table-wrap">
            <table className="fiche-table">
              <thead>
                <tr>
                  <th className="fiche-th">Poste</th>
                  <th className="fiche-th">Service</th>
                  <th className="fiche-th">Période</th>
                  <th className="fiche-th">Observation</th>
                </tr>
              </thead>
              <tbody>
                {historiqueProfessionnel.map((h, idx) => (
                  <tr key={h?.id ?? `${h?.poste ?? 'hist'}-${idx}`}>
                    <td className="fiche-td">{h?.poste ?? '—'}</td>
                    <td className="fiche-td">{h?.service?.nom ?? '—'}</td>
                    <td className="fiche-td">
                      {formatDate(h?.date_debut)} → {h?.date_fin ? formatDate(h?.date_fin) : 'En cours'}
                    </td>
                    <td className="fiche-td">{h?.observation ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      )}

      {activeTab === 'observations' && (
        <Section titre="Observations RH">
          <div className="fiche-observation">
            {employe.observation || 'Aucune observation enregistrée.'}
          </div>
        </Section>
      )}

      {editOpen && (
        <div className="fiche-overlay" onClick={() => setEditOpen(false)}>
          <div className="fiche-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="fiche-modal-title">Modifier l'employé</h3>
            <form onSubmit={onEditSubmit}>
              <div className="fiche-modal-grid">
                <FormField label="Prénom"          name="prenom"         value={editForm.prenom}         onChange={onEditChange} />
                <FormField label="Nom"             name="nom"            value={editForm.nom}            onChange={onEditChange} />
                <FormField label="Sexe"            name="sexe"           value={editForm.sexe}           onChange={onEditChange} type="select"
                  options={[{ value: 'M', label: 'Masculin' }, { value: 'F', label: 'Féminin' }]} />
                <FormField label="Statut"          name="statut"         value={editForm.statut}         onChange={onEditChange} type="select"
                  options={STATUTS.map((s) => ({ value: s, label: s }))} />
                <FormField label="Date naissance"  name="date_naissance" value={editForm.date_naissance} onChange={onEditChange} type="date" />
                <FormField label="Date embauche"   name="date_embauche"  value={editForm.date_embauche}  onChange={onEditChange} type="date" />
                <FormField label="Catégorie"       name="categorie"      value={editForm.categorie}      onChange={onEditChange} />
                <FormField label="Échelle"         name="echelle"        value={editForm.echelle}        onChange={onEditChange} />
                <FormField label="Échelon"         name="echelon"        value={editForm.echelon}        onChange={onEditChange} />
                <FormField label="Fonction"        name="fonction"       value={editForm.fonction}       onChange={onEditChange} />
                <FormField label="Qualification"   name="qualification"  value={editForm.qualification}  onChange={onEditChange} />
                <FormField label="Entité"          name="entite"         value={editForm.entite}         onChange={onEditChange} />
                <FormField label="Affectation"     name="affectation"    value={editForm.affectation}    onChange={onEditChange} />
                <FormField label="Solde congé (jours)" name="solde_conge" value={editForm.solde_conge}  onChange={onEditChange} type="number" />
              </div>
              <FormField label="Observation" name="observation" value={editForm.observation} onChange={onEditChange} type="textarea" rows={3} />

              {editError   && <div className="fiche-form-error">{editError}</div>}
              {editSuccess && <div className="fiche-form-success">Modifications sauvegardées !</div>}

              <div className="fiche-modal-actions">
                <button type="button" className="fiche-cancel-btn" onClick={() => setEditOpen(false)} disabled={editSaving}>
                  Annuler
                </button>
                <button type="submit" className="fiche-primary-btn" disabled={editSaving}>
                  {editSaving ? 'Sauvegarde...' : 'Sauvegarder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

function Section({ titre, children }) {
  return (
    <div className="fiche-section">
      <h3 className="fiche-section-title">{titre}</h3>
      {children}
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div className="fiche-info-item">
      <span className="fiche-info-label">{label}</span>
      <span className="fiche-info-value">{value}</span>
    </div>
  )
}

function Metric({ label, value, tone }) {
  return (
    <div className={`fiche-metric fiche-metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
