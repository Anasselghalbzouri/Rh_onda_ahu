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
import DocumentsEmployesPage from './components/DocumentsEmployesPage/DocumentsEmployesPage'
import MesDocumentsPage from './components/MesDocumentsPage/MesDocumentsPage'
import Unauthorized from './components/Unauthorized/Unauthorized'
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute'

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
          <Route
            path="documents-employes"
            element={
              <ProtectedRoute allowedRoles={['rh', 'dg']}>
                <DocumentsEmployesPage readOnly={user?.role === 'dg'} />
              </ProtectedRoute>
            }
          />
          <Route path="profil" element={<MesDocumentsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
