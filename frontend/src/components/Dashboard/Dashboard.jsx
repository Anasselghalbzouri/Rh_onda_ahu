import './Dashboard.css'

const CARDS = [
  { label: 'Effectif total' },
  { label: 'Congés en cours' },
  { label: 'Absences ce mois' },
  { label: 'Avances en attente' },
]

export default function Dashboard() {
  return (
    <div className="dashboard-container">
      <h2 className="dashboard-title">Tableau de bord</h2>
      <p className="dashboard-subtitle">Les statistiques RH seront disponibles ici — Module 3.</p>

      <div className="dashboard-grid">
        {CARDS.map((card) => (
          <div key={card.label} className="dashboard-card">
            <div className="dashboard-card-label">{card.label}</div>
            <div className="dashboard-card-value">—</div>
          </div>
        ))}
      </div>
    </div>
  )
}
