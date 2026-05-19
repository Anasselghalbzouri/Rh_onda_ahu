import { useNavigate } from 'react-router-dom'
import './Unauthorized.css'

export default function Unauthorized() {
  const navigate = useNavigate()

  return (
    <div className="unauthorized-page">
      <div className="unauthorized-card">
        <div className="unauthorized-icon">🚫</div>
        <h1 className="unauthorized-title">Accès refusé</h1>
        <p className="unauthorized-text">
          Vous n'avez pas les droits nécessaires pour accéder à cette page.
        </p>
        <button className="unauthorized-back-btn" onClick={() => navigate(-1)}>
          Retour
        </button>
      </div>
    </div>
  )
}
