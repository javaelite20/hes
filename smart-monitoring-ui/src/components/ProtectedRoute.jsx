import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, role }) {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />

  // Wrong role — redirect to the right home for that role
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/dashboard'} replace />
  }

  return children
}
