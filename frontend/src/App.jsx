import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import LoginPage from './components/LoginPage/LoginPage'
import Layout from './components/Layout/Layout'
import Dashboard from './components/Dashboard/Dashboard'
import PersonnelPage from './components/PersonnelPage/PersonnelPage'
import Unauthorized from './components/Unauthorized/Unauthorized'
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute'

const Placeholder = ({ title }) => (
  <div style={{ padding: '2rem 0' }}>
    <h2 style={{ margin: '0 0 0.5rem', color: '#1a3c5e', fontSize: '1.4rem', fontWeight: 700 }}>{title}</h2>
    <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Ce module sera disponible prochainement.</p>
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
          <Route path="conges" element={<Placeholder title="Congés" />} />
          <Route path="absences" element={<Placeholder title="Absences" />} />
          <Route path="avances" element={<Placeholder title="Avances" />} />
          <Route path="profil" element={<Placeholder title="Mon profil" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
