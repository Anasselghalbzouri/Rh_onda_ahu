/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock3, GraduationCap, MapPin, Star } from 'lucide-react'
import api from '../../api'
import { useAuth } from '../../useAuth'
import EvaluationFormationModal from '../EvaluationFormationModal/EvaluationFormationModal'
import './MesFormationsPage.css'

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fr-FR')
}

const getFormationStatus = (formation) => {
  const today = new Date()
  const start = formation?.date_debut ? new Date(formation.date_debut) : null
  const end = formation?.date_fin ? new Date(formation.date_fin) : null

  if (start && today < start) return { key: 'upcoming', label: 'A venir', icon: Clock3 }
  if (end && today > end) return { key: 'done', label: 'Terminee', icon: CheckCircle2 }
  return { key: 'active', label: 'En cours', icon: CalendarDays }
}

const findEvaluation = (formation, employeId) => {
  const evaluations = Array.isArray(formation?.evaluations) ? formation.evaluations : []
  return evaluations.find((evaluation) => String(evaluation.employe_id) === String(employeId)) ?? null
}

export default function MesFormationsPage() {
  const { user } = useAuth()
  const employeId = user?.employe_id ?? user?.employe?.id ?? user?.id
  const [formations, setFormations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedFormation, setSelectedFormation] = useState(null)

  const loadFormations = useCallback(async () => {
    if (!employeId) {
      setError('Impossible de determiner le profil employe connecte.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get(`/employes/${employeId}/formations`)
      setFormations(Array.isArray(data) ? data : data?.data ?? [])
    } catch {
      setFormations([])
      setError('Impossible de charger vos formations.')
    } finally {
      setLoading(false)
    }
  }, [employeId])

  useEffect(() => {
    loadFormations()
  }, [loadFormations])

  const counters = useMemo(() => {
    return formations.reduce((acc, formation) => {
      const status = getFormationStatus(formation).key
      acc[status] = (acc[status] ?? 0) + 1
      return acc
    }, { upcoming: 0, active: 0, done: 0 })
  }, [formations])

  const onEvaluationSaved = (evaluation) => {
    setFormations((prev) => prev.map((formation) => {
      if (formation.id !== selectedFormation?.id) return formation
      const evaluations = Array.isArray(formation.evaluations) ? formation.evaluations : []
      return { ...formation, evaluations: [...evaluations.filter((item) => item.id !== evaluation.id), evaluation] }
    }))
  }

  return (
    <div className="mes-formations-container">
      <div className="mes-formations-header">
        <div>
          <p className="mes-formations-subtitle">Suivre les sessions et deposer une evaluation</p>
          <h2>Mes formations</h2>
        </div>
      </div>

      <div className="mes-formations-kpis">
        <Metric label="A venir" value={counters.upcoming} tone="info" />
        <Metric label="En cours" value={counters.active} tone="warning" />
        <Metric label="Terminees" value={counters.done} tone="success" />
      </div>

      {loading ? (
        <div className="mes-formation-empty">Chargement des formations...</div>
      ) : error ? (
        <div className="mes-formation-error">{error}</div>
      ) : formations.length === 0 ? (
        <div className="mes-formation-empty">Aucune formation rattachee a votre profil.</div>
      ) : (
        <div className="mes-formations-grid">
          {formations.map((formation) => {
            const status = getFormationStatus(formation)
            const StatusIcon = status.icon
            const evaluation = findEvaluation(formation, employeId)
            const canEvaluate = status.key === 'done' && !evaluation

            return (
              <article key={formation.id} className="mes-formation-card">
                <div className="mes-formation-top">
                  <span className="mes-formation-icon"><GraduationCap size={18} aria-hidden="true" /></span>
                  <span className={`mes-formation-status status-${status.key}`}>
                    <StatusIcon size={13} aria-hidden="true" />
                    {status.label}
                  </span>
                </div>
                <h3>{formation.intitule}</h3>
                <div className="mes-formation-meta">
                  <span><CalendarDays size={14} aria-hidden="true" /> {formatDate(formation.date_debut)} - {formatDate(formation.date_fin)}</span>
                  <span><MapPin size={14} aria-hidden="true" /> {formation.lieu ?? 'Lieu non renseigne'}</span>
                </div>
                {evaluation ? (
                  <div className="mes-formation-evaluated">
                    <Star size={15} aria-hidden="true" />
                    Evaluation enregistree: {evaluation.note ?? evaluation.note_20 ?? '-'} / 20
                  </div>
                ) : (
                  <button
                    type="button"
                    className="mes-formation-evaluate"
                    disabled={!canEvaluate}
                    onClick={() => setSelectedFormation(formation)}
                  >
                    Evaluer
                  </button>
                )}
              </article>
            )
          })}
        </div>
      )}

      <EvaluationFormationModal
        isOpen={Boolean(selectedFormation)}
        formation={selectedFormation}
        employeId={employeId}
        onClose={() => setSelectedFormation(null)}
        onSaved={onEvaluationSaved}
      />
    </div>
  )
}

function Metric({ label, value, tone }) {
  return (
    <div className={`mes-formation-metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
