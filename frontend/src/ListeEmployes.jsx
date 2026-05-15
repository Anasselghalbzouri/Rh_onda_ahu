import { useEffect, useState } from 'react'
import api from './api'

export default function ListeEmployes() {
  const [employes, setEmployes]   = useState([])
  const [meta, setMeta]           = useState(null)
  const [page, setPage]           = useState(1)
  const [search, setSearch]       = useState('')
  const [statut, setStatut]       = useState('')
  const [loading, setLoading]     = useState(false)

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
    <div style={styles.container}>
      {/* Filters */}
      <div style={styles.toolbar}>
        <input
          style={styles.searchInput}
          type="text"
          placeholder="Rechercher nom, prénom, matricule, fonction..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          style={styles.select}
          value={statut}
          onChange={(e) => setStatut(e.target.value)}
        >
          <option value="">Tous les statuts</option>
          <option value="actif">Actif</option>
          <option value="retraite">Retraité</option>
          <option value="depart_volontaire">Départ volontaire</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <p style={styles.loading}>Chargement...</p>
      ) : (
        <>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thead}>
                  <th style={styles.th}>Matricule</th>
                  <th style={styles.th}>Nom complet</th>
                  <th style={styles.th}>Fonction</th>
                  <th style={styles.th}>Service</th>
                  <th style={styles.th}>Date embauche</th>
                  <th style={styles.th}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {employes.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={styles.empty}>
                      Aucun employé trouvé.
                    </td>
                  </tr>
                ) : (
                  employes.map((emp) => (
                    <tr key={emp.id} style={styles.tr}>
                      <td style={styles.td}>{emp.matricule}</td>
                      <td style={styles.td}>{emp.prenom} {emp.nom}</td>
                      <td style={styles.td}>{emp.fonction ?? '—'}</td>
                      <td style={styles.td}>{emp.service?.nom ?? '—'}</td>
                      <td style={styles.td}>{emp.date_embauche ?? '—'}</td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.badge,
                          background: emp.statut === 'actif' ? '#d1fae5' : '#fee2e2',
                          color:      emp.statut === 'actif' ? '#065f46' : '#991b1b',
                        }}>
                          {emp.statut ?? '—'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && meta.last_page > 1 && (
            <div style={styles.pagination}>
              <button
                style={styles.pageBtn}
                disabled={page === 1}
                onClick={() => handlePage(page - 1)}
              >
                ← Précédent
              </button>
              <span style={styles.pageInfo}>
                Page {meta.current_page} / {meta.last_page}
                &nbsp;({meta.total} employés)
              </span>
              <button
                style={styles.pageBtn}
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

const styles = {
  container: { padding: '1.5rem' },
  toolbar: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '1.2rem',
    flexWrap: 'wrap',
  },
  searchInput: {
    flex: 1,
    minWidth: '220px',
    padding: '0.6rem 1rem',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '0.95rem',
  },
  select: {
    padding: '0.6rem 1rem',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '0.95rem',
    background: '#fff',
  },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 8px rgba(0,0,0,0.07)' },
  thead: { background: '#1a3c5e' },
  th: { padding: '0.85rem 1rem', color: '#fff', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '0.8rem 1rem', fontSize: '0.9rem', color: '#374151' },
  badge: { padding: '0.2rem 0.7rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 },
  empty: { textAlign: 'center', padding: '2rem', color: '#9ca3af' },
  loading: { textAlign: 'center', padding: '3rem', color: '#6b7280' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', marginTop: '1.2rem' },
  pageBtn: { padding: '0.5rem 1.2rem', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontWeight: 600 },
  pageInfo: { fontSize: '0.9rem', color: '#6b7280' },
}
