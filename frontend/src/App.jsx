import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import LoginPage from './components/LoginPage/LoginPage'
import Layout from './components/Layout/Layout'
import Dashboard from './components/Dashboard/Dashboard'
import PersonnelPage from './components/PersonnelPage/PersonnelPage'
import CongesPage from './components/CongesPage/CongesPage'
import FormationsPage from './components/FormationsPage/FormationsPage'
import RapportActivitePage from './components/RapportActivitePage/RapportActivitePage'
import RapportEmployesPage from './components/RapportEmployesPage/RapportEmployesPage'
import DocumentsEmployesPage from './components/DocumentsEmployesPage/DocumentsEmployesPage'
import ReclamationsPage from './components/ReclamationsPage/ReclamationsPage'
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

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout user={user} onLogout={logout} />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/personnel" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="personnel" element={<PersonnelPage />} />
          <Route path="conges" element={<CongesPage />} />
          <Route path="formations" element={<FormationsPage />} />
          <Route path="rapport-activite" element={<RapportActivitePage />} />
          <Route path="rapport-employes" element={<RapportEmployesPage />} />
          <Route path="documents-employes" element={<DocumentsEmployesPage />} />
          <Route path="reclamations" element={<ReclamationsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
