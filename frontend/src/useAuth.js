import { useState } from 'react'
import api from './api'

export function useAuth() {
  const [user, setUser]   = useState(() => JSON.parse(localStorage.getItem('user') || 'null'))
  const [token, setToken] = useState(() => localStorage.getItem('token'))

  const login = async (matricule, password) => {
    const { data } = await api.post('/login', { matricule, password })
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    setToken(data.token)
    setUser(data.user)
  }

  const logout = async () => {
    try {
      await api.post('/logout')
    } catch {
      // La déconnexion locale doit quand même s'exécuter si la session serveur est déjà expirée.
    }
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  return { user, token, login, logout, isAuthenticated: !!token }
}
