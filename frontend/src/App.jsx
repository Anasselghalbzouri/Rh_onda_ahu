import { useAuth } from './useAuth'
import LoginPage from './LoginPage'
import Dashboard from './Dashboard'

export default function App() {
  const { user, login, logout, isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <LoginPage onLogin={login} />
  }

  return <Dashboard user={user} onLogout={logout} />
}
