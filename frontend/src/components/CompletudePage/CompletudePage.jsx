/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react'
import api from '../../api'
import './CompletudePage.css'

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('fr-FR')
}

const toneFor = (taux) => {
  if (taux === null || taux === undefined) return 'neutral'
  if (taux >= 80) return 'success'
  if (taux >= 50) return 'warning'
  return 'danger'
}

export default function CompletudePage() {
  const [onglet, setOnglet] = useState('incomplets')

  const [services, setServices] = useState([])
  const [serviceId, setServiceId] = useState('')
  const [categorie, setCategorie] = useState('')

  const [groupes, setGroupes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [taux, setTaux] = useState(null)
  const [tauxLoading, setTauxLoading] = useState(false)
  const [tauxError, setTauxError] = useState(null)

  useEffect(() => {
    api.get('/services')
      .then(({ data }) => setServices(Array.isArray(data) ? data : []))
      .catch(() => setServices([]))
  }, [])

  useEffect(() => {
    if (onglet !== 'incomplets') return undefined
    let cancelled = false
    setLoading(true)
    setError(null)
    api.get('/completude/dossiers-incomplets', {
      params: {
        service_id: serviceId || undefined,
        categorie: categorie || undefined,
      },
    })
      .then(({ data }) => { if (!cancelled) setGroupes(data.services ?? []) })
      .catch(() => { if (!cancelled) setError('Impossible de charger les dossiers incomplets.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [onglet, serviceId, categorie])

  useEffect(() => {
    if (onglet !== 'taux') return undefined
    let cancelled = false
    setTauxLoading(true)
    setTauxError(null)
    api.get('/completude/taux')
      .then(({ data }) => { if (!cancelled) setTaux(data) })
      .catch(() => { if (!cancelled) setTauxError('Impossible de charger les taux de complétude.') })
      .finally(() => { if (!cancelled) setTauxLoading(false) })
    return () => { cancelled = true }
  }, [onglet])

  const totalIncomplets = useMemo(
    () => groupes.reduce((somme, groupe) => somme + groupe.employes.length, 0),
    [groupes]
  )

  return (
    <div className="completude-container">
      <div className="completude-page-header">
        <p className="completude-page-subtitle">Qualité et complétude du référentiel</p>
        <h2 className="completude-page-title">Complétude des dossiers</h2>
      </div>

      <div className="completude-tabs" role="tablist" aria-label="Vues de complétude">
        <button
          type="button"
          role="tab"
          aria-selected={onglet === 'incomplets'}
          className={onglet === 'incomplets' ? 'active' : ''}
          onClick={() => setOnglet('incomplets')}
        >
          Dossiers incomplets
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={onglet === 'taux'}
          className={onglet === 'taux' ? 'active' : ''}
          onClick={() => setOnglet('taux')}
        >
          Taux par service / catégorie
        </button>
      </div>

      {onglet === 'incomplets' && (
        <div className="completude-card">
          <div className="completude-form-grid">
            <label className="completude-field">
              Service
              <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                <option value="">Tous les services</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>{service.nom}</option>
                ))}
              </select>
            </label>

            <label className="completude-field">
              Catégorie
              <select value={categorie} onChange={(e) => setCategorie(e.target.value)}>
                <option value="">Toutes les catégories</option>
                <option value="Cadre Supérieur">Cadre Supérieur</option>
                <option value="Cadre">Cadre</option>
                <option value="Haute Maîtrise">Haute Maîtrise</option>
                <option value="Maîtrise">Maîtrise</option>
                <option value="Exécution Principal">Exécution Principal</option>
                <option value="Exécution">Exécution</option>
              </select>
            </label>
          </div>

          {error && <div className="completude-error">{error}</div>}

          {loading ? (
            <div className="completude-empty">Chargement...</div>
          ) : totalIncomplets === 0 ? (
            <div className="completude-empty">Aucun dossier incomplet pour ces critères.</div>
          ) : (
            groupes.map((groupe) => (
              <div key={groupe.service_id ?? 'null'} className="completude-groupe">
                <div className="completude-groupe-header">
                  <h3>{groupe.service_nom}</h3>
                  <span className="completude-badge">{groupe.employes.length}</span>
                </div>
                {groupe.employes.length === 0 ? (
                  <div className="completude-empty completude-empty-inline">Aucun agent actif incomplet.</div>
                ) : (
                  <div className="completude-table-wrap">
                    <table className="completude-table">
                      <thead>
                        <tr>
                          <th>Matricule</th>
                          <th>Agent</th>
                          <th>Catégorie</th>
                          <th>Taux</th>
                          <th>Champs manquants</th>
                          <th>Dernier calcul</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupe.employes.map((employe) => (
                          <tr key={employe.id}>
                            <td>{employe.matricule ?? '—'}</td>
                            <td>{employe.nom_complet ?? '—'}</td>
                            <td>{employe.categorie ?? '—'}</td>
                            <td>
                              <span className={`completude-taux completude-taux-${toneFor(employe.taux_completude)}`}>
                                {employe.taux_completude ?? '—'}%
                              </span>
                            </td>
                            <td>
                              <ul className="completude-manquants">
                                {(employe.champs_manquants ?? []).map((champ) => (
                                  <li key={champ}>{champ}</li>
                                ))}
                              </ul>
                            </td>
                            <td>{formatDate(employe.date_dernier_calcul)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {onglet === 'taux' && (
        <div className="completude-card">
          {tauxError && <div className="completude-error">{tauxError}</div>}

          {tauxLoading ? (
            <div className="completude-empty">Chargement...</div>
          ) : (
            <>
              <div className="completude-groupe">
                <div className="completude-groupe-header">
                  <h3>Par service</h3>
                </div>
                {(taux?.par_service ?? []).length === 0 ? (
                  <div className="completude-empty completude-empty-inline">Aucun agent actif.</div>
                ) : (
                  <div className="completude-table-wrap">
                    <table className="completude-table">
                      <thead>
                        <tr>
                          <th>Service</th>
                          <th>Agents actifs</th>
                          <th>Dossiers complets</th>
                          <th>Taux moyen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(taux?.par_service ?? []).map((ligne, index) => (
                          <tr key={`${ligne.service_id ?? 'null'}-${index}`}>
                            <td>{ligne.service_nom}</td>
                            <td>{ligne.nb_agents_actifs}</td>
                            <td>{ligne.nb_complets}</td>
                            <td>
                              {ligne.nb_agents_actifs === 0 || ligne.taux_moyen === null ? (
                                <span className="completude-muted">Aucun agent actif</span>
                              ) : (
                                <span className={`completude-taux completude-taux-${toneFor(ligne.taux_moyen)}`}>
                                  {ligne.taux_moyen}%
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="completude-groupe">
                <div className="completude-groupe-header">
                  <h3>Par catégorie</h3>
                </div>
                {(taux?.par_categorie ?? []).length === 0 ? (
                  <div className="completude-empty completude-empty-inline">Aucun agent actif.</div>
                ) : (
                  <div className="completude-table-wrap">
                    <table className="completude-table">
                      <thead>
                        <tr>
                          <th>Catégorie</th>
                          <th>Agents actifs</th>
                          <th>Dossiers complets</th>
                          <th>Taux moyen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(taux?.par_categorie ?? []).map((ligne, index) => (
                          <tr key={`${ligne.categorie ?? 'null'}-${index}`}>
                            <td>{ligne.categorie ?? 'Non renseignée'}</td>
                            <td>{ligne.nb_agents_actifs}</td>
                            <td>{ligne.nb_complets}</td>
                            <td>
                              {ligne.nb_agents_actifs === 0 || ligne.taux_moyen === null ? (
                                <span className="completude-muted">Aucun agent actif</span>
                              ) : (
                                <span className={`completude-taux completude-taux-${toneFor(ligne.taux_moyen)}`}>
                                  {ligne.taux_moyen}%
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
