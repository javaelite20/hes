import { createContext, useContext, useState, useCallback } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const signIn = useCallback((data) => {
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify({
      loginId:     data.loginId,
      name:        data.name,
      role:        data.role,
      towerNumber: data.towerNumber,
      flatNumber:  data.flatNumber,
    }))
    setUser({
      loginId:     data.loginId,
      name:        data.name,
      role:        data.role,
      towerNumber: data.towerNumber,
      flatNumber:  data.flatNumber,
    })
  }, [])

  const signOut = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
