/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Maximize2, Minimize2, X } from 'lucide-react'
import ListeEmployes from '../ListeEmployes/ListeEmployes'
import FicheEmploye from '../FicheEmploye/FicheEmploye'
import './PersonnelPage.css'

// Onglets de la vue résumée du panneau ; « Voir le détail » affiche la fiche complète.
const ONGLETS_RESUME = ['profil', 'conges', 'documents']

// La liste reste montée pendant qu'une fiche est ouverte : recherche, filtres, tri et page sont conservés.
export default function PersonnelPage() {
  const location = useLocation()
  const [selectedEmployeId, setSelectedEmployeId] = useState(null)
  const [agrandi, setAgrandi] = useState(false)
  const [ficheModifiee, setFicheModifiee] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (location.state?.selectedEmployeId) {
      setSelectedEmployeId(location.state.selectedEmployeId)
    }
  }, [location.state])

  const peutQuitter = () => !ficheModifiee || window.confirm('Des modifications ne sont pas enregistrées. Les abandonner ?')

  const choisir = (id) => {
    if (id === selectedEmployeId || !peutQuitter()) return
    setFicheModifiee(false)
    setSelectedEmployeId(id)
  }

  const fermer = ({ sansConfirmation = false } = {}) => {
    if (!sansConfirmation && !peutQuitter()) return
    const idFerme = selectedEmployeId
    setFicheModifiee(false)
    setAgrandi(false)
    setSelectedEmployeId(null)
    requestAnimationFrame(() => document.querySelector(`[data-employe-id="${idFerme}"]`)?.focus())
  }

  useEffect(() => {
    if (!selectedEmployeId) return undefined
    const onKey = (e) => { if (e.key === 'Escape') fermer() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const classes = ['personnel-page', selectedEmployeId && 'personnel-page--panneau', agrandi && 'personnel-page--agrandi']

  return (
    <div className={classes.filter(Boolean).join(' ')}>
      <div className="personnel-liste">
        <ListeEmployes onSelectEmploye={choisir} selectedId={selectedEmployeId} refreshKey={version} />
      </div>
      {selectedEmployeId && (
        <aside className="personnel-panneau" aria-label="Fiche employé">
          <div className="personnel-panneau-entete">
            <button type="button" className="personnel-panneau-btn" aria-pressed={agrandi} onClick={() => setAgrandi((a) => !a)}>
              {agrandi ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
              {agrandi ? 'Vue résumée' : 'Voir le détail'}
            </button>
            <button type="button" className="personnel-panneau-btn" aria-label="Fermer la fiche" onClick={() => fermer()}>
              <X size={15} aria-hidden="true" />
              Fermer
            </button>
          </div>
          <FicheEmploye
            key={selectedEmployeId}
            id={selectedEmployeId}
            masquerRetour
            onRetour={() => { fermer({ sansConfirmation: true }); setVersion((v) => v + 1) }}
            onSaved={() => setVersion((v) => v + 1)}
            onDirtyChange={setFicheModifiee}
            onglets={agrandi ? null : ONGLETS_RESUME}
          />
        </aside>
      )}
    </div>
  )
}
