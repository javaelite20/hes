import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function NotFound() {
  const { user } = useAuth()
  const home = user?.role === 'ADMIN' ? '/admin' : user ? '/dashboard' : '/login'

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: 24,
      textAlign: 'center',
    }}>
      <p style={{ fontSize: 72, lineHeight: 1 }}>404</p>
      <h1 className="text-2xl">Page not found</h1>
      <p className="text-secondary">The page you're looking for doesn't exist.</p>
      <Link to={home} className="btn btn-primary" style={{ marginTop: 8 }}>
        Go home
      </Link>
    </div>
  )
}
