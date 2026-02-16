import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Onboarding from './pages/Onboarding'
import Bills from './pages/Bills'
import Calendar from './pages/Calendar'
import WhatIfSimulator from './pages/WhatIfSimulator'
import Portfolio from './pages/Portfolio'
import Experiences from './pages/Experiences'
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
  const needsProfile = user && !user.email && !user.username

  const redirectAfterLogin = needsProfile ? '/' : (needsOnboarding ? '/onboarding' : '/')

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to={redirectAfterLogin} /> : <Login onLogin={setUser} />} />
        <Route path="/register" element={user ? <Navigate to={redirectAfterLogin} /> : <Register onRegister={setUser} />} />
        <Route path="/" element={user ? <Layout user={user} onLogout={() => setUser(null)} onUpdate={refreshUser} /> : <Navigate to="/login" />}>
          <Route index element={needsProfile ? <Dashboard user={user} /> : (needsOnboarding ? <Navigate to="/onboarding" replace /> : <Dashboard user={user} />)} />
          <Route path="profile" element={<Navigate to="/" replace />} />
          <Route path="onboarding" element={needsProfile ? <Navigate to="/profile" replace /> : <Onboarding user={user} onComplete={refreshUser} />} />
          <Route path="bills" element={needsProfile ? <Navigate to="/profile" replace /> : <Bills />} />
          <Route path="calendar" element={needsProfile ? <Navigate to="/profile" replace /> : <Calendar />} />
          <Route path="money" element={<Navigate to="/" replace />} />
          <Route path="risk" element={<Navigate to="/portfolio" replace />} />
          <Route path="experiences" element={<Experiences />} />
          <Route path="simulator" element={<WhatIfSimulator />} />
          <Route path="portfolio" element={needsProfile ? <Navigate to="/profile" replace /> : <Portfolio />} />
        </Route>
        <Route path="*" element={<Navigate to={user ? (needsOnboarding ? '/onboarding' : '/') : '/login'} />} />
      </Routes>
    </BrowserRouter>
  )
}
