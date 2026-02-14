import React from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { logout } from '../api/auth'
import AssistantFab from './AssistantFab'
import './Layout.css'

export default function Layout({ user, onLogout }) {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    onLogout()
    navigate('/login')
  }

  const nav = [
    { to: '/', label: 'Dashboard' },
    { to: '/money', label: 'Money & Crypto' },
    { to: '/bills', label: 'Bill Payments' },
    { to: '/calendar', label: 'Calendar' },
    { to: '/risk', label: 'Risk' },
  ]

  return (
    <div className="layout">
      <header className="layout-header">
        <div className="layout-brand">Nightshade</div>
        <nav className="layout-nav">
          {nav.map(({ to, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => 'layout-nav-link' + (isActive ? ' active' : '')}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="layout-user">
          <span className="layout-user-email">{user?.email || user?.username || 'User'}</span>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
      <AssistantFab />
    </div>
  )
}
