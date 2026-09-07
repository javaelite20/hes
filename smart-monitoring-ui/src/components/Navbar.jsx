import { useAuth } from '../context/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import './Navbar.css'

export default function Navbar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = () => {
    signOut()
    navigate('/login')
  }

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-brand">
          <span className="navbar-logo">⚡</span>
          <span className="navbar-name">SmartMonitoring</span>
        </Link>

        <div className="navbar-right">
          {user && (
            <>
              <div className="navbar-user">
                <span className="navbar-user-name">{user.name}</span>
                {user.flatNumber && (
                  <span className="text-tertiary text-sm">{user.towerNumber}_{user.flatNumber}</span>
                )}
                <span className={`badge ${user.role === 'ADMIN' ? 'badge-warning' : 'badge-neutral'}`}>
                  {user.role}
                </span>
              </div>
              <button className="btn btn-sm btn-secondary" onClick={handleSignOut}>
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
