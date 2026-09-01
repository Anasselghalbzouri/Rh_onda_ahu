import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import LoginPage from './components/LoginPage/LoginPage'
import Layout from './components/Layout/Layout'
import Dashboard from './components/Dashboard/Dashboard'
import PersonnelPage from './components/PersonnelPage/PersonnelPage'
import CongesPage from './components/CongesPage/CongesPage'
import FormationsPage from './components/FormationsPage/FormationsPage'
import MesFormationsPage from './components/MesFormationsPage/MesFormationsPage'
import RapportActivitePage from './components/RapportActivitePage/RapportActivitePage'
import Unauthorized from './components/Unauthorized/Unauthorized'
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute'


const Placeholder = ({ title }) => (
  <div style={{ padding: '0' }}>
    <p style={{ fontSize: 13, color: 'var(--neutral-500)', fontWeight: 500, marginBottom: 4 }}>Module en développement</p>
    <h2 style={{ margin: '0 0 var(--space-4)', color: 'var(--neutral-900)', fontSize: 28, fontWeight: 700 }}>{title}</h2>
    <div style={{
      background: 'var(--white)',
      border: '1px solid var(--neutral-200)',
      borderRadius: 'var(--radius-lg)',
      padding: '3rem',
      textAlign: 'center',
      boxShadow: 'var(--shadow-md)',
    }}>
      <p style={{ color: 'var(--neutral-400)', fontSize: 14 }}>Ce module sera disponible prochainement.</p>
    </div>
  </div>
)

export default function App() {
  const { user, login, logout, isAuthenticated } = useAuth()

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/personnel" replace /> : <LoginPage onLogin={login} />}
        />
        <Route path="/unauthorized" element={<Unauthorized />} />

        <Route
          path="/"
          element={
            <ProtectedRoute allowedRoles={['rh', 'dg', 'employe']}>
              <Layout user={user} onLogout={logout} />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/personnel" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="personnel" element={<PersonnelPage />} />
          <Route path="conges" element={<CongesPage />} />
          <Route
            path="formations"
            element={
              <ProtectedRoute allowedRoles={['rh']}>
                <FormationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="mes-formations"
            element={
              <ProtectedRoute allowedRoles={['employe']}>
                <MesFormationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="rapport-activite"
            element={
              <ProtectedRoute allowedRoles={['rh']}>
                <RapportActivitePage />
              </ProtectedRoute>
            }
          />
          <Route path="absences" element={<Placeholder title="Absences" />} />
          <Route path="profil" element={<Placeholder title="Mon profil" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
