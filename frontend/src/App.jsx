import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import LoginPage from './LoginPage'
import Dashboard from './Dashboard'
import Unauthorized from './Unauthorized'
import ProtectedRoute from './ProtectedRoute'

export default function App() {
  const { user, login, logout, isAuthenticated } = useAuth()

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage onLogin={login} />}
        />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute allowedRoles={['rh']}>
              <Dashboard user={user} onLogout={logout} />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
