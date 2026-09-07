import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

export default function Register() {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '', email: '', password: '', phoneNumber: '', flatNumber: '',
  })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
    setErrors((er) => ({ ...er, [e.target.name]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.email.trim()) errs.email = 'Email is required'
    if (form.password.length < 8) errs.password = 'Minimum 8 characters'
    if (!form.flatNumber.trim()) errs.flatNumber = 'Flat number is required'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setServerError('')
    setLoading(true)
    try {
      const data = await register(form)
      signIn(data)
      navigate('/dashboard')
    } catch (err) {
      const msg = err.response?.data?.message
      if (msg?.toLowerCase().includes('email')) {
        setErrors({ email: 'Email already registered' })
      } else {
        setServerError(msg || 'Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card card-lg">
        <div className="auth-header">
          <span className="auth-logo">⚡</span>
          <h1 className="text-2xl">Create account</h1>
          <p className="text-secondary text-sm">SmartMonitoring</p>
        </div>

        {serverError && <div className="alert alert-danger">{serverError}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Full name</label>
            <input
              className={`form-input ${errors.name ? 'error' : ''}`}
              type="text"
              name="name"
              placeholder="Ramesh Kumar"
              value={form.name}
              onChange={handleChange}
              autoFocus
            />
            {errors.name && <span className="form-error">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className={`form-input ${errors.email ? 'error' : ''}`}
              type="email"
              name="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
            />
            {errors.email && <span className="form-error">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className={`form-input ${errors.password ? 'error' : ''}`}
              type="password"
              name="password"
              placeholder="Min. 8 characters"
              value={form.password}
              onChange={handleChange}
            />
            {errors.password && <span className="form-error">{errors.password}</span>}
          </div>

          <div className="auth-row">
            <div className="form-group">
              <label className="form-label">Flat number</label>
              <input
                className={`form-input ${errors.flatNumber ? 'error' : ''}`}
                type="text"
                name="flatNumber"
                placeholder="A-101"
                value={form.flatNumber}
                onChange={handleChange}
              />
              {errors.flatNumber && <span className="form-error">{errors.flatNumber}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Phone <span className="text-tertiary">(optional)</span></label>
              <input
                className="form-input"
                type="tel"
                name="phoneNumber"
                placeholder="9876543210"
                value={form.phoneNumber}
                onChange={handleChange}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : 'Create account'}
          </button>
        </form>

        <div className="auth-footer">
          <span className="text-secondary text-sm">Already have an account? </span>
          <Link to="/login" className="text-sm">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
