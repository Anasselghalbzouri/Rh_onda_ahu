import { useEffect, useState } from 'react'
import api from '../../api'
import './ListeEmployes.css'

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('fr-FR')
}

export default function ListeEmployes({ onSelectEmploye }) {
  const [employes, setEmployes] = useState([])
  const [meta, setMeta] = useState(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statut, setStatut] = useState('')
  const [loading, setLoading] = useState(false)

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

  return (
    <div className="liste-container">
      <div className="liste-toolbar">
        <input
          className="liste-search-input"
          type="text"
          placeholder="Rechercher nom, prénom, matricule, fonction..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="liste-select"
          value={statut}
          onChange={(e) => setStatut(e.target.value)}
        >
          <option value="">Tous les statuts</option>
          <option value="actif">Actif</option>
          <option value="retraite">Retraité</option>
          <option value="depart_volontaire">Départ volontaire</option>
        </select>
      </div>

      {loading ? (
        <p className="liste-loading">Chargement...</p>
      ) : (
        <>
          <div className="liste-table-wrapper">
            <table className="liste-table">
              <thead className="liste-thead">
                <tr>
                  <th className="liste-th">Matricule</th>
                  <th className="liste-th">Nom complet</th>
                  <th className="liste-th">Fonction</th>
                  <th className="liste-th">Service</th>
                  <th className="liste-th">Date embauche</th>
                  <th className="liste-th">Statut</th>
                </tr>
              </thead>
              <tbody>
                {employes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="liste-empty">
                      Aucun employé trouvé.
                    </td>
                  </tr>
                ) : (
                  employes.map((emp) => (
                    <tr
                      key={emp.id}
                      className="liste-tr"
                      onClick={() => onSelectEmploye && onSelectEmploye(emp.id)}
                    >
                      <td className="liste-td">{emp.matricule}</td>
                      <td className="liste-td">{emp.prenom} {emp.nom}</td>
                      <td className="liste-td">{emp.fonction ?? '—'}</td>
                      <td className="liste-td">{emp.service?.nom ?? '—'}</td>
                      <td className="liste-td">{formatDate(emp.date_embauche)}</td>
                      <td className="liste-td">
                        <span className={`liste-badge ${emp.statut === 'actif' ? 'liste-badge-actif' : 'liste-badge-inactif'}`}>
                          {emp.statut ?? '—'}
                        </span>
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
    </div>
  )
}
