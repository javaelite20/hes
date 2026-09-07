import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ loginId: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(form.loginId, form.password)
      signIn(data)
      navigate(data.role === 'ADMIN' ? '/admin' : '/dashboard')
    } catch (err) {
      setError(
        err.response?.status === 401
          ? 'Incorrect login ID or password.'
          : 'Something went wrong. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card card-lg">
        <div className="auth-header">
          <span className="auth-logo">⚡</span>
          <h1 className="text-2xl">Sign in</h1>
          <p className="text-secondary text-sm">SmartMonitoring</p>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Login ID</label>
            <input
              className="form-input"
              type="text"
              name="loginId"
              placeholder="e.g. 01_A-101 or admin@society.com"
              value={form.loginId}
              onChange={handleChange}
              required
              autoFocus
              autoComplete="username"
            />
            <span className="form-hint">
              Residents: tower_flat (e.g. 01_A-101) · Admins: email
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              name="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
