/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-static-element-interactions, react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react'
import { Search, X, UserPlus, Trash2 } from 'lucide-react'
import api from '../../api'

const normalizeList = (payload) => payload?.data ?? payload ?? []

export default function InscriptionPanel({ formation, onClose, onChanged }) {
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [selectedEmploye, setSelectedEmploye] = useState(null)
  const [saving, setSaving] = useState(false)

  const formationId = formation?.id

  const loadDetails = useCallback(async () => {
    if (!formationId) return
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get(`/formations/${formationId}`)
      setDetails(data)
    } catch {
      setDetails(formation)
      setError('Impossible de charger les inscrits depuis le serveur.')
    } finally {
      setLoading(false)
    }
  }, [formation, formationId])

  useEffect(() => {
    setDetails(null)
    setQuery('')
    setSuggestions([])
    setSelectedEmploye(null)
    loadDetails()
  }, [formationId, loadDetails])

  if (!formation) return null

  const employes = Array.isArray(details?.employes) ? details.employes : []

  const searchEmployes = async (value) => {
    setQuery(value)
    setSelectedEmploye(null)
    if (value.trim().length < 2) {
      setSuggestions([])
      return
    }
    try {
      const { data } = await api.get('/employes', { params: { search: value } })
      setSuggestions(normalizeList(data).slice(0, 6))
    } catch {
      setSuggestions([])
    }
  }

  const inscrire = async () => {
    if (!selectedEmploye) return
    setSaving(true)
    setError(null)
    try {
      await api.post(`/formations/${formation.id}/employes`, { employe_id: selectedEmploye.id })
      setQuery('')
      setSuggestions([])
      setSelectedEmploye(null)
      await loadDetails()
      onChanged?.()
    } catch {
      setError("Impossible d'inscrire cet employe.")
    } finally {
      setSaving(false)
    }
  }

  const desinscrire = async (employeId) => {
    setSaving(true)
    setError(null)
    try {
      await api.delete(`/formations/${formation.id}/employes/${employeId}`)
      await loadDetails()
      onChanged?.()
    } catch {
      setError("Impossible de desinscrire l'employe.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="formation-panel-overlay" onClick={onClose}>
      <aside className="formation-panel" onClick={(event) => event.stopPropagation()} aria-label="Inscrits formation">
        <div className="formation-panel-header">
          <div>
            <p>Inscrits</p>
            <h3>{formation.intitule ?? 'Formation'}</h3>
          </div>
          <button type="button" className="formation-icon-btn" onClick={onClose} aria-label="Fermer le panneau">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="formation-panel-search">
          <label htmlFor="formation-employee-search">Inscrire employe</label>
          <div className="formation-search-box">
            <Search size={14} aria-hidden="true" />
            <input
              id="formation-employee-search"
              value={query}
              onChange={(event) => searchEmployes(event.target.value)}
              placeholder="Matricule ou nom..."
              autoComplete="off"
            />
          </div>
          {suggestions.length > 0 && (
            <div className="formation-suggestions">
              {suggestions.map((employe) => (
                <button
                  key={employe.id}
                  type="button"
                  onClick={() => {
                    setSelectedEmploye(employe)
                    setQuery(`${employe.prenom} ${employe.nom} (${employe.matricule})`)
                    setSuggestions([])
                  }}
                >
                  <strong>{employe.prenom} {employe.nom}</strong>
                  <span>{employe.matricule}</span>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="formation-panel-primary"
            onClick={inscrire}
            disabled={!selectedEmploye || saving}
          >
            <UserPlus size={15} aria-hidden="true" />
            Inscrire employe
          </button>
        </div>

        {error && <div className="formation-panel-error">{error}</div>}

        <div className="formation-panel-list">
          {loading ? (
            <div className="formation-empty">Chargement...</div>
          ) : employes.length === 0 ? (
            <div className="formation-empty">Aucun employe inscrit.</div>
          ) : (
            employes.map((employe) => (
              <div key={employe.id} className="formation-panel-row">
                <span className="formation-avatar">
                  {`${employe.prenom?.[0] ?? ''}${employe.nom?.[0] ?? ''}`.toUpperCase()}
                </span>
                <span className="formation-panel-person">
                  <strong>{employe.prenom} {employe.nom}</strong>
                  <small>{employe.matricule} - {employe.pivot?.statut ?? 'inscrit'}</small>
                </span>
                <button
                  type="button"
                  className="formation-icon-btn danger"
                  onClick={() => desinscrire(employe.id)}
                  disabled={saving}
                  aria-label={`Desinscrire ${employe.prenom} ${employe.nom}`}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  )
}
