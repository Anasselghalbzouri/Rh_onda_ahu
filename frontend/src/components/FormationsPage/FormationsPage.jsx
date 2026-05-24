/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CheckCircle2, ChevronDown, GraduationCap, Pencil, Plus, Search, Trash2, Users } from 'lucide-react'
import api from '../../api'
import FormationFormModal from './FormationFormModal'
import InscriptionPanel from './InscriptionPanel'
import Modal from '../ui/Modal/Modal'
import './FormationsPage.css'

const PLAN_STATUS_LABEL = {
  draft: 'Brouillon',
  valide: 'Valide',
  clos: 'Archive',
}

const FORMATION_TYPE_LABEL = {
  interne: 'Interne',
  externe: 'Externe',
}

const normalizePage = (payload) => ({
  rows: Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [],
  meta: Array.isArray(payload?.data) ? payload : null,
})

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fr-FR')
}

const formatMoney = (value) => {
  const amount = Number(value ?? 0)
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'MAD',
    maximumFractionDigits: 0,
  }).format(amount)
}

const currentYear = new Date().getFullYear()

export default function FormationsPage() {
  const location = useLocation()
  const [activeTab, setActiveTab] = useState(location.state?.employeId ? 'catalogue' : 'plans')
  const [plans, setPlans] = useState([])
  const [plansLoading, setPlansLoading] = useState(false)
  const [plansError, setPlansError] = useState(null)
  const [expandedPlanId, setExpandedPlanId] = useState(null)
  const [planDetails, setPlanDetails] = useState({})
  const [validatingPlanId, setValidatingPlanId] = useState(null)

  const [formations, setFormations] = useState([])
  const [formationsMeta, setFormationsMeta] = useState(null)
  const [formationsLoading, setFormationsLoading] = useState(false)
  const [formationsError, setFormationsError] = useState(null)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    type: '',
    annee: String(currentYear),
    plan_id: '',
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [editFormation, setEditFormation] = useState(null)
  const [panelFormation, setPanelFormation] = useState(null)
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [planForm, setPlanForm] = useState({annee: String(currentYear), statut: 'draft', titre: '',  description: '', })
  const [planSaving, setPlanSaving] = useState(false)
  const [planError, setPlanError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const loadPlans = useCallback(async () => {
    setPlansLoading(true)
    setPlansError(null)
    try {
      const { data } = await api.get('/plans-formation')
      setPlans(normalizePage(data).rows)
    } catch {
      setPlans([])
      setPlansError('Impossible de charger les plans de formation.')
    } finally {
      setPlansLoading(false)
    }
  }, [])

  const loadFormations = useCallback(async (nextPage = page) => {
    setFormationsLoading(true)
    setFormationsError(null)
    try {
      const params = { page: nextPage }
      if (filters.type) params.type = filters.type
      if (filters.annee) params.annee = filters.annee
      if (filters.plan_id) params.plan_id = filters.plan_id
      const { data } = await api.get('/formations', { params })
      const normalized = normalizePage(data)
      setFormations(normalized.rows)
      setFormationsMeta(normalized.meta)
    } catch {
      setFormations([])
      setFormationsMeta(null)
      setFormationsError('Impossible de charger le catalogue des formations.')
    } finally {
      setFormationsLoading(false)
    }
  }, [filters, page])

  const loadPlanDetail = useCallback(async (planId, force = false) => {
    if (!planId || (!force && planDetails[planId])) return
    try {
      const { data } = await api.get(`/plans-formation/${planId}`)
      setPlanDetails((prev) => ({ ...prev, [planId]: data }))
    } catch {
      setPlanDetails((prev) => ({
        ...prev,
        [planId]: { formations: [], error: 'Impossible de charger les formations de ce plan.' },
      }))
    }
  }, [planDetails])

  useEffect(() => {
    loadPlans()
  }, [loadPlans])

  useEffect(() => {
    setPage(1)
  }, [filters])

  useEffect(() => {
    loadFormations(page)
  }, [loadFormations, page])

  const years = useMemo(() => {
    const set = new Set([currentYear - 1, currentYear, currentYear + 1])
    plans.forEach((plan) => {
      if (plan.annee) set.add(Number(plan.annee))
    })
    return [...set].sort((a, b) => b - a)
  }, [plans])

  const togglePlan = (planId) => {
    const next = expandedPlanId === planId ? null : planId
    setExpandedPlanId(next)
    if (next) loadPlanDetail(next)
  }

  const validatePlan = async (planId) => {
    setValidatingPlanId(planId)
    try {
      await api.put(`/plans-formation/${planId}`, { statut: 'valide' })
      await loadPlans()
      setPlanDetails((prev) => {
        const next = { ...prev }
        delete next[planId]
        return next
      })
      await loadPlanDetail(planId, true)
    } finally {
      setValidatingPlanId(null)
    }
  }

  const refreshAll = async () => {
    await Promise.all([loadPlans(), loadFormations(page)])
    setPlanDetails({})
    if (expandedPlanId) loadPlanDetail(expandedPlanId, true)
  }

  const openCreate = () => {
    setEditFormation(null)
    setModalOpen(true)
  }

  const openEdit = (formation) => {
    setEditFormation(formation)
    setModalOpen(true)
  }

  const onFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const deleteFormation = async (id) => {
    if (!window.confirm('Supprimer cette formation ?')) return
    setDeletingId(id)
    try {
      await api.delete(`/formations/${id}`)
      await refreshAll()
    } finally {
      setDeletingId(null)
    }
  }

  const submitPlan = async (event) => {
    event.preventDefault()
    setPlanSaving(true)
    setPlanError(null)
    try {
      await api.post('/plans-formation', {
        annee: Number(planForm.annee),
        statut: planForm.statut,
        titre: planForm.titre,
        description: planForm.description || null,
        
      })
      setPlanModalOpen(false)
      setPlanForm({annee: String(currentYear),statut: 'draft' , titre: '',  description: '', })
      await loadPlans()
    } catch (err) {
      const messages = err.response?.data?.errors
      setPlanError(messages ? Object.values(messages).flat().join(' - ') : 'Impossible de creer le plan.')
    } finally {
      setPlanSaving(false)
    }
  }

  return (
    <div className="formations-container">
      <div className="formations-page-header">
        <div>
          <p className="formations-page-subtitle">Planifier, suivre et inscrire les employes</p>
          <h2 className="formations-title">Formations</h2>
        </div>
        <button type="button" className="formation-btn-primary" onClick={openCreate}>
          <Plus size={15} aria-hidden="true" />
          Nouvelle formation
        </button>
      </div>

      <div className="formations-tabs" role="tablist" aria-label="Sections formations">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'plans'}
          className={activeTab === 'plans' ? 'active' : ''}
          onClick={() => setActiveTab('plans')}
        >
          Plan annuel
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'catalogue'}
          className={activeTab === 'catalogue' ? 'active' : ''}
          onClick={() => setActiveTab('catalogue')}
        >
          Catalogue
        </button>
      </div>

      {activeTab === 'plans' && (
        <section className="formations-card">
          <div className="formations-section-head">
            <div>
              <h3>Plans annuels</h3>
              <p>Validation et lecture detaillee des formations planifiees.</p>
            </div>
            <button type="button" className="formation-btn-primary" onClick={() => setPlanModalOpen(true)}>
              <Plus size={14} aria-hidden="true" />
              Creer plan
            </button>
          </div>

          {plansLoading ? (
            <div className="formation-empty">Chargement des plans...</div>
          ) : plansError ? (
            <div className="formation-error">{plansError}</div>
          ) : plans.length === 0 ? (
            <div className="formation-empty">Aucun plan de formation disponible.</div>
          ) : (
            <div className="formations-accordion">
              {plans.map((plan) => {
                const isOpen = expandedPlanId === plan.id
                const detail = planDetails[plan.id]
                const planFormations = Array.isArray(detail?.formations) ? detail.formations : []
                return (
                  <article key={plan.id} className="formation-plan-item">
                    <button type="button" className="formation-plan-summary" onClick={() => togglePlan(plan.id)}>
                      <span className="formation-plan-main">
                        <strong>{plan.titre ?? `Plan ${plan.annee ?? ''}`}</strong>
                        <small>{plan.annee ?? '-'} - {plan.formations_count ?? planFormations.length ?? 0} formations</small>
                      </span>
                      <span className={`formation-status status-${plan.statut ?? 'draft'}`}>
                        {PLAN_STATUS_LABEL[plan.statut] ?? plan.statut ?? 'Brouillon'}
                      </span>
                      <ChevronDown className={isOpen ? 'open' : ''} size={18} aria-hidden="true" />
                    </button>

                    {isOpen && (
                      <div className="formation-plan-body">
                        {detail?.error && <div className="formation-error">{detail.error}</div>}
                        {plan.statut === 'draft' && (
                          <button
                            type="button"
                            className="formation-btn-success"
                            disabled={validatingPlanId === plan.id}
                            onClick={() => validatePlan(plan.id)}
                          >
                            <CheckCircle2 size={15} aria-hidden="true" />
                            {validatingPlanId === plan.id ? 'Validation...' : 'Valider plan'}
                          </button>
                        )}
                        {planFormations.length === 0 ? (
                          <div className="formation-empty">Aucune formation rattachee a ce plan.</div>
                        ) : (
                          <div className="formation-plan-list">
                            {planFormations.map((formation) => (
                              <div key={formation.id} className="formation-plan-row">
                                <GraduationCap size={17} aria-hidden="true" />
                                <span>
                                  <strong>{formation.intitule}</strong>
                                  <small>{formatDate(formation.date_debut)} - {formatDate(formation.date_fin)} - {formation.lieu ?? 'Lieu non renseigne'}</small>
                                </span>
                                <span className={`formation-type type-${formation.type}`}>
                                  {FORMATION_TYPE_LABEL[formation.type] ?? formation.type}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}

      {activeTab === 'catalogue' && (
        <>
          <div className="formations-toolbar">
            <div className="formations-filter">
              <label>
                Type
                <select name="type" value={filters.type} onChange={onFilterChange}>
                  <option value="">Tous</option>
                  <option value="interne">Interne</option>
                  <option value="externe">Externe</option>
                </select>
              </label>
              <label>
                Annee
                <select name="annee" value={filters.annee} onChange={onFilterChange}>
                  <option value="">Toutes</option>
                  {years.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
              <label>
                Plan
                <select name="plan_id" value={filters.plan_id} onChange={onFilterChange}>
                  <option value="">Tous les plans</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>{plan.titre ?? `Plan ${plan.annee}`}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="formations-search-note">
              <Search size={14} aria-hidden="true" />
              <span>{formationsMeta?.total ?? formations.length} formation(s)</span>
            </div>
          </div>

          <section className="formations-table-card">
            {formationsLoading ? (
              <div className="formation-empty">Chargement du catalogue...</div>
            ) : formationsError ? (
              <div className="formation-error">{formationsError}</div>
            ) : (
              <div className="formations-table-wrap">
                <table className="formations-table">
                  <thead>
                    <tr>
                      <th>Intitule</th>
                      <th>Type</th>
                      <th>Dates</th>
                      <th>Plan</th>
                      <th>Budget</th>
                      <th>Inscrits</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formations.length === 0 ? (
                      <tr><td colSpan={7} className="formation-empty-cell">Aucune formation trouvee.</td></tr>
                    ) : formations.map((formation) => (
                      <tr key={formation.id}>
                        <td>
                          <strong>{formation.intitule}</strong>
                          <small>{formation.organisme || formation.lieu || 'Details non renseignes'}</small>
                        </td>
                        <td>
                          <span className={`formation-type type-${formation.type}`}>
                            {FORMATION_TYPE_LABEL[formation.type] ?? formation.type}
                          </span>
                        </td>
                        <td>{formatDate(formation.date_debut)} - {formatDate(formation.date_fin)}</td>
                        <td>{formation.plan_formation?.titre ?? formation.planFormation?.titre ?? '-'}</td>
                        <td>{formatMoney(formation.budget_prevu ?? formation.cout)}</td>
                        <td>
                          <button type="button" className="formation-link-btn" onClick={() => setPanelFormation(formation)}>
                            <Users size={14} aria-hidden="true" />
                            {formation.employes_count ?? formation.nb_inscrits ?? 0}
                          </button>
                        </td>
                        <td>
                          <div className="formation-row-actions">
                            <button type="button" className="formation-icon-btn" onClick={() => openEdit(formation)} aria-label="Modifier la formation">
                              <Pencil size={15} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="formation-icon-btn danger"
                              onClick={() => deleteFormation(formation.id)}
                              disabled={deletingId === formation.id}
                              aria-label="Supprimer la formation"
                            >
                              <Trash2 size={15} aria-hidden="true" />
                            </button>
                            <button type="button" className="formation-link-btn" onClick={() => setPanelFormation(formation)}>
                              Inscrits
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {formationsMeta && formationsMeta.last_page > 1 && (
            <div className="formations-pagination">
              <button type="button" disabled={page === 1} onClick={() => setPage((prev) => prev - 1)}>Precedent</button>
              <span>Page {formationsMeta.current_page} / {formationsMeta.last_page}</span>
              <button type="button" disabled={page === formationsMeta.last_page} onClick={() => setPage((prev) => prev + 1)}>Suivant</button>
            </div>
          )}
        </>
      )}

      <FormationFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={refreshAll}
        formation={editFormation}
        plans={plans}
      />

      {panelFormation && (
        <InscriptionPanel
          formation={panelFormation}
          onClose={() => setPanelFormation(null)}
          onChanged={refreshAll}
        />
      )}

      <Modal isOpen={planModalOpen} onClose={() => setPlanModalOpen(false)} title="Nouveau plan de formation" size="sm">
        <form onSubmit={submitPlan} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', fontSize: '13px', fontWeight: 600 }}>
            Titre
            <input
              type="text"
              value={planForm.titre}
              onChange={(e) => setPlanForm((p) => ({ ...p, titre: e.target.value }))}
              required
              style={{ padding: '8px var(--space-3)', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', fontSize: '13px', fontWeight: 600 }}>
            Annee
            <input
              type="number"
              value={planForm.annee}
              onChange={(e) => setPlanForm((p) => ({ ...p, annee: e.target.value }))}
              required
              min={2020}
              max={2030}
              style={{ padding: '8px var(--space-3)', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', fontSize: '13px', fontWeight: 600 }}>
            Description
            <textarea
              value={planForm.description}
              onChange={(e) => setPlanForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              style={{ padding: '8px var(--space-3)', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-sm)', fontSize: '13px', resize: 'vertical' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', fontSize: '13px', fontWeight: 600 }}>
            Statut
            <select
              value={planForm.statut}
              onChange={(e) => setPlanForm((p) => ({ ...p, statut: e.target.value }))}
              style={{ padding: '8px var(--space-3)', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}
            >
              <option value="draft">Brouillon</option>
              <option value="valide">Valide</option>
              <option value="clos">Archive</option>
            </select>
          </label>
          {planError && <div className="formation-error">{planError}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
            <button type="button" className="eval-btn-secondary" onClick={() => setPlanModalOpen(false)} disabled={planSaving}>
              Annuler
            </button>
            <button type="submit" className="formation-btn-primary" disabled={planSaving}>
              {planSaving ? 'Creation...' : 'Creer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
