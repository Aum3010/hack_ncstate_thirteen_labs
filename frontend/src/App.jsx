import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Onboarding from './pages/Onboarding'
import Calendar from './pages/Calendar'
import Money from './pages/Money'
import Risk from './pages/Risk'
import { getMe } from './api/auth'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = () => {
    return getMe().then((data) => setUser(data.user))
  }

  useEffect(() => {
    refreshUser().catch(() => setUser(null)).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)' }}>
        <span style={{ color: 'var(--neon-blue)' }}>Loading...</span>
      </div>
    )
  }

  const needsOnboarding = user && !user.onboarding_completed

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to={needsOnboarding ? "/onboarding" : "/"} /> : <Login onLogin={setUser} />} />
        <Route path="/register" element={user ? <Navigate to={needsOnboarding ? "/onboarding" : "/"} /> : <Register onRegister={setUser} />} />
        <Route path="/" element={user ? <Layout user={user} onLogout={() => setUser(null)} /> : <Navigate to="/login" />}>
          <Route index element={needsOnboarding ? <Navigate to="/onboarding" replace /> : <Dashboard user={user} />} />
          <Route path="onboarding" element={<Onboarding user={user} onComplete={refreshUser} />} />
          <Route path="bills" element={<Calendar />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="money" element={<Money />} />
          <Route path="risk" element={<Risk />} />
        </Route>
        <Route path="*" element={<Navigate to={user ? (needsOnboarding ? "/onboarding" : "/") : "/login"} />} />
      </Routes>
    </BrowserRouter>
  )
}
