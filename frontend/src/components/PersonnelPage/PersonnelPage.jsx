/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import ListeEmployes from '../ListeEmployes/ListeEmployes'
import FicheEmploye from '../FicheEmploye/FicheEmploye'
import './PersonnelPage.css'

export default function PersonnelPage() {
  const location = useLocation()
  const [selectedEmployeId, setSelectedEmployeId] = useState(null)

  useEffect(() => {
    if (location.state?.selectedEmployeId) {
      setSelectedEmployeId(location.state.selectedEmployeId)
    }
  }, [location.state])

  return (
    <div className="personnel-page">
      {selectedEmployeId ? (
        <FicheEmploye id={selectedEmployeId} onRetour={() => setSelectedEmployeId(null)} />
      ) : (
        <ListeEmployes onSelectEmploye={setSelectedEmployeId} />
      )}
    </div>
  )
}
