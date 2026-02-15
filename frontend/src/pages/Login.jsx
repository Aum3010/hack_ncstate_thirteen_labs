import React, { useState, useEffect, lazy, Suspense } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login, loginWithPhantom, getMe } from '../api/auth'
import './Auth.css'

const AuthScene3D = lazy(() => import('../components/AuthScene3D'))

export default function Login({ onLogin }) {
  const navigate = useNavigate()
  const [emailOrUsername, setEmailOrUsername] = useState('')
  useEffect(() => {
    document.body.classList.add('wallpaper-bg')
    return () => document.body.classList.remove('wallpaper-bg')
  }, [])
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [phantomLoading, setPhantomLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(emailOrUsername, password)
      const { user } = await getMe()
      onLogin(user)
      navigate((user?.email || user?.username) ? '/' : '/profile')
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handlePhantom = async () => {
    setError('')
    setPhantomLoading(true)
    try {
      const { user } = await loginWithPhantom()
      onLogin(user)
      navigate((user?.email || user?.username) ? '/' : '/profile')
    } catch (err) {
      setError(err.message || 'Phantom sign-in failed')
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
        <p className="auth-subtitle">Sign in</p>
        <button
          type="button"
          className="btn btn-ember"
          onClick={handlePhantom}
          disabled={phantomLoading}
          style={{ marginBottom: '1rem', width: '100%' }}
        >
          {phantomLoading ? 'Connecting...' : 'Sign in with Phantom'}
        </button>
        <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>or</p>
        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}
          <input
            className="input"
            type="text"
            placeholder="Email or username"
            value={emailOrUsername}
            onChange={(e) => setEmailOrUsername(e.target.value)}
            required
            autoComplete="username"
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <button type="submit" className="btn btn-ember" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="auth-footer">
          No account? <Link to="/register">Register</Link>.
        </p>
      </div>
    </div>
  )
}
