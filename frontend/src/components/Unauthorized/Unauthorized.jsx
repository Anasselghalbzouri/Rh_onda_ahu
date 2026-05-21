import { useNavigate } from 'react-router-dom'
import { ShieldOff, ArrowLeft } from 'lucide-react'
import './Unauthorized.css'

export default function Unauthorized() {
  const navigate = useNavigate()

  return (
    <div className="unauthorized-page">
      <div className="unauthorized-card">
        <div className="unauthorized-icon" aria-hidden="true">
          <ShieldOff size={32} />
        </div>
        <h1 className="unauthorized-title">Accès refusé</h1>
        <p className="unauthorized-text">
          Vous n'avez pas les droits nécessaires pour accéder à cette page.
        </p>
        <button className="unauthorized-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} aria-hidden="true" />
          Retour
        </button>
      </div>
    </div>
  )
}
