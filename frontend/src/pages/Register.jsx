import React, { useState, useEffect, lazy, Suspense } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register, loginWithPhantom, getMe } from '../api/auth'
import './Auth.css'

const AuthScene3D = lazy(() => import('../components/AuthScene3D'))

export default function Register({ onRegister }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  useEffect(() => {
    document.body.classList.add('wallpaper-bg')
    return () => document.body.classList.remove('wallpaper-bg')
  }, [])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [phantomLoading, setPhantomLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(email, password, username || undefined)
      const { user } = await getMe()
      onRegister(user)
      navigate((user?.email || user?.username) ? '/' : '/profile')
    } catch (err) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const handlePhantom = async () => {
    setError('')
    setPhantomLoading(true)
    try {
      const { user } = await loginWithPhantom()
      onRegister(user)
      navigate((user?.email || user?.username) ? '/' : '/profile')
    } catch (err) {
      setError(err.message || 'Phantom sign-up failed')
    } finally {
      setPhantomLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <Suspense fallback={null}>
        <AuthScene3D />
      </Suspense>
      <div className="auth-card">
        <h1 className="auth-title">Nightshade</h1>
        <p className="auth-subtitle">Create account</p>
        <button
          type="button"
          className="btn btn-ember"
          onClick={handlePhantom}
          disabled={phantomLoading}
          style={{ marginBottom: '1rem', width: '100%' }}
        >
          {phantomLoading ? 'Connecting...' : 'Sign up with Phantom'}
        </button>
        <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>or</p>
        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}
          <input
            className="input"
            type="email"
            placeholder="Email (required)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            className="input"
            type="text"
            placeholder="Username (optional)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <input
            className="input"
            type="password"
            placeholder="Password (min 6)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
          <button type="submit" className="btn btn-ember" disabled={loading}>
            {loading ? 'Creating...' : 'Register'}
          </button>
        </form>
        <p className="auth-footer">
          Have an account? <Link to="/login">Sign in</Link>.
        </p>
      </div>
    </div>
  )
}
