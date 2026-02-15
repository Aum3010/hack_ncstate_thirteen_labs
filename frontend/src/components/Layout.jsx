import React, { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { logout } from '../api/auth'
import { listBills, markPaid } from '../api/bills'
import { listWallets, syncWallet } from '../api/wallets'
import AssistantFab from './AssistantFab'
import './Layout.css'

export default function Layout({ user, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [notifOpen, setNotifOpen] = useState(false)
  const [dueAlerts, setDueAlerts] = useState([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [highlightAlertId, setHighlightAlertId] = useState(null)
  const [primaryWalletId, setPrimaryWalletId] = useState(null)
  const syncingRef = useRef(false)

  const handleLogout = async () => {
    await logout()
    try { sessionStorage.removeItem('notifToastShown') } catch {}
    onLogout()
    navigate('/login')
  }

  useEffect(() => {
    const today = new Date()
    const clampDay = (d) => Math.min(parseInt(d, 10) || 1, 28)
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const daysBetween = (a, b) => Math.ceil((a - b) / (1000 * 60 * 60 * 24))

    // Show toast once per session immediately after layout mounts
    try {
      const alreadyShown = sessionStorage.getItem('notifToastShown') === '1'
      if (!alreadyShown) {
        setShowToast(true)
        sessionStorage.setItem('notifToastShown', '1')
        setTimeout(() => setShowToast(false), 7000)
      }
    } catch {}

    setNotifLoading(true)
    listBills()
      .then((bills) => {
        const alerts = []
        bills.forEach((b) => {
          if (b.paid_at) return
          const remind = parseInt(b.reminder_days_before, 10) || 3

          if (b.due_date) {
            const due = new Date(b.due_date)
            const days = daysBetween(due, startOfToday)
            // Upcoming within reminder window or any overdue
            if (days <= remind || days < 0) {
              alerts.push({
                id: b.id,
                name: b.name,
                amount: (b.amount_cents / 100).toFixed(2),
                dueKey: fmt(due),
                days,
              })
            }
            return
          }

          if (b.due_day) {
            const dueThisMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), clampDay(b.due_day))
            const days = daysBetween(dueThisMonth, startOfToday)
            if (days <= remind || days < 0) {
              alerts.push({
                id: b.id,
                name: b.name,
                amount: (b.amount_cents / 100).toFixed(2),
                dueKey: fmt(dueThisMonth),
                days,
              })
            }
          }
        })
        alerts.sort((a, b) => a.days - b.days)
        setDueAlerts(alerts)
      })
      .catch(() => setDueAlerts([]))
      .finally(() => setNotifLoading(false))
  }, [])

  // Locate the user's primary wallet once (if any)
  useEffect(() => {
    let cancelled = false
    const loadWallet = async () => {
      try {
        const wallets = await listWallets()
        if (!cancelled && wallets && wallets.length > 0) {
          setPrimaryWalletId(wallets[0].id)
        }
      } catch {}
    }
    loadWallet()
    return () => { cancelled = true }
  }, [])

  // Auto-sync Solana wallet every 10 seconds, preventing overlapping runs
  useEffect(() => {
    if (!primaryWalletId) return
    const interval = setInterval(async () => {
      if (syncingRef.current) return
      syncingRef.current = true
      try {
        await syncWallet(primaryWalletId)
        try { window.dispatchEvent(new CustomEvent('solanaSynced', { detail: { walletId: primaryWalletId } })) } catch {}
      } catch {}
      finally {
        syncingRef.current = false
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [primaryWalletId])

  // Refresh alerts when a bill is marked paid/unpaid from other views
  useEffect(() => {
    const onBillPaid = () => {
      const today = new Date()
      const clampDay = (d) => Math.min(parseInt(d, 10) || 1, 28)
      const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const daysBetween = (a, b) => Math.ceil((a - b) / (1000 * 60 * 60 * 24))
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      setNotifLoading(true)
      listBills()
        .then((bills) => {
          const alerts = []
          bills.forEach((b) => {
            if (b.paid_at) return
            const remind = parseInt(b.reminder_days_before, 10) || 3
            if (b.due_date) {
              const due = new Date(b.due_date)
              const days = daysBetween(due, startOfToday)
              if (days <= remind || days < 0) {
                alerts.push({ id: b.id, name: b.name, amount: (b.amount_cents / 100).toFixed(2), dueKey: fmt(due), days })
              }
              return
            }
            if (b.due_day) {
              const dueThisMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), clampDay(b.due_day))
              const days = daysBetween(dueThisMonth, startOfToday)
              if (days <= remind || days < 0) {
                alerts.push({ id: b.id, name: b.name, amount: (b.amount_cents / 100).toFixed(2), dueKey: fmt(dueThisMonth), days })
              }
            }
          })
          alerts.sort((a, b) => a.days - b.days)
          setDueAlerts(alerts)
        })
        .catch(() => setDueAlerts([]))
        .finally(() => setNotifLoading(false))
    }
    window.addEventListener('billPaid', onBillPaid)
    return () => window.removeEventListener('billPaid', onBillPaid)
  }, [])

  // When a bill is highlighted, ensure it's visible and clear highlight after a short delay
  useEffect(() => {
    if (highlightAlertId) {
      // Open dropdown if not already
      setNotifOpen(true)
      // Scroll into view after DOM paints
      const t = setTimeout(() => {
        const el = document.getElementById(`notif-item-${highlightAlertId}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      }, 50)
      const clear = setTimeout(() => setHighlightAlertId(null), 5000)
      return () => { clearTimeout(t); clearTimeout(clear) }
    }
  }, [highlightAlertId])

  // Debug toggle: force show toast via ?showToast=1
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search)
      if (params.get('showToast') === '1') {
        setShowToast(true)
      }
    } catch {}
  }, [location.search])

  const nav = [
    { to: '/', label: 'Dashboard' },
    { to: '/money', label: 'Money & Crypto' },
    { to: '/calendar', label: 'Calendar & Bills' },
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
          <div className="notif-bell-wrap">
            <button type="button" className="btn notif-bell" onClick={() => setNotifOpen((s) => !s)} aria-label="Notifications">
              <span role="img" aria-hidden>🔔</span>
              {dueAlerts.length > 0 && <span className="notif-badge">{dueAlerts.length}</span>}
            </button>
            {showToast && (
              <div className="notif-tooltip" role="status" aria-live="polite">
                <div className="notif-tooltip-main">
                  {dueAlerts.length > 0 ? (
                    <span>You have {dueAlerts.length} upcoming bill{dueAlerts.length > 1 ? 's' : ''}.</span>
                  ) : (
                    <span>Welcome back! No upcoming bills.</span>
                  )}
                </div>
                <div className="notif-tooltip-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setShowToast(false)
                      // Target the most imminent bill
                      const target = dueAlerts.length > 0 ? dueAlerts[0].id : null
                      if (target) setHighlightAlertId(target)
                      // Open dropdown to show due bills without redirecting
                      setNotifOpen(true)
                    }}
                  >
                    View due bills
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowToast(false)}>Dismiss</button>
                </div>
              </div>
            )}
            {notifOpen && (
              <div className="notif-dropdown">
                <div className="notif-header">
                  <span>Due bills</span>
                  <button type="button" className="btn btn-ghost" onClick={() => navigate('/calendar')}>Open calendar</button>
                </div>
                {notifLoading ? (
                  <div className="text-muted">Loading…</div>
                ) : dueAlerts.length === 0 ? (
                  <div className="text-muted">No upcoming bills</div>
                ) : (
                  dueAlerts.map((a) => (
                    <div
                      key={a.id}
                      id={`notif-item-${a.id}`}
                      className={"notif-item" + (highlightAlertId === a.id ? ' highlight' : '') + (a.days <= 0 ? ' due' : '')}
                    >
                      <div className="notif-main">
                        <span className="notif-name">{a.name}</span>
                        <span className="notif-amount">${a.amount}</span>
                      </div>
                      <div className="notif-meta">
                        <span className="notif-due">Due: {a.dueKey}</span>
                        <span className={"notif-days " + (a.days < 0 ? 'overdue' : 'upcoming')}>
                          {a.days < 0 ? `Overdue by ${Math.abs(a.days)}d` : (a.days === 0 ? 'Due today' : `Due in ${a.days}d`)}
                        </span>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={async () => {
                            await markPaid(a.id, true)
                            // Notify other views (e.g., Calendar) to update immediately
                            try { window.dispatchEvent(new CustomEvent('billPaid', { detail: { id: a.id, paid: true } })) } catch {}
                            setDueAlerts((prev) => prev.filter((x) => x.id !== a.id))
                          }}
                        >
                          Mark paid
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
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
