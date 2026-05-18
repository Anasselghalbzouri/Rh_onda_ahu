import { useNavigate } from 'react-router-dom'

export default function Unauthorized() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f3f4f6',
      fontFamily: 'sans-serif',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 12,
        padding: '48px 64px',
        textAlign: 'center',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🚫</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
          Accès refusé
        </h1>
        <p style={{ color: '#6b7280', marginBottom: 32 }}>
          Vous n'avez pas les droits nécessaires pour accéder à cette page.
        </p>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: '10px 24px',
            background: '#1d4ed8',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Retour
        </button>
      </div>
    </div>
  )
}
