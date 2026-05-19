import { useState } from 'react'
import ListeEmployes from '../ListeEmployes/ListeEmployes'
import FicheEmploye from '../FicheEmploye/FicheEmploye'
import './PersonnelPage.css'

export default function PersonnelPage() {
  const [selectedEmployeId, setSelectedEmployeId] = useState(null)

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
