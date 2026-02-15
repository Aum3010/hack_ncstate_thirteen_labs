import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { logout } from '../api/auth'
import { listBills, markPaid } from '../api/bills'
import { listWallets, syncWallet } from '../api/wallets'
import AssistantFab from './AssistantFab'
import ChatBar from './ChatBar'
import ProfileModal from './ProfileModal'
import './Layout.css'
// import UrbanNoirSharedBackdrop from './UrbanNoir/UrbanNoirSharedBackdrop'
import noirBackdrop from '../../media/glamorous-skyline-12160696.webp'

export default function Layout({ user, onLogout, onUpdate }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [notifOpen, setNotifOpen] = useState(false)
  const [dueAlerts, setDueAlerts] = useState([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [highlightAlertId, setHighlightAlertId] = useState(null)
  const [primaryWalletId, setPrimaryWalletId] = useState(null)
  const syncingRef = useRef(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)

  // Urban Noir background state
  const canvasRef = useRef(null)
  const [scrollY, setScrollY] = useState(0)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })

  const handleLogout = async () => {
    await logout()
    try { sessionStorage.removeItem('notifToastShown') } catch {}
    onLogout()
    navigate('/login')
  }

  useEffect(() => {
    // Background viewport tracking
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    onResize()
    window.addEventListener('resize', onResize)
    const onScroll = () => setScrollY(window.scrollY || window.pageYOffset || 0)
    window.addEventListener('scroll', onScroll, { passive: true })

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
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll)
    }
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

  // Twinkling starfield
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let rafId = 0
    let stars = []
    const init = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      const count = Math.floor((canvas.width * canvas.height) / 15000)
      stars = new Array(count).fill(0).map(() => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.6 + 0.2,
        tw: Math.random() * Math.PI * 2,
        s: 0.6 + Math.random() * 1.2,
      }))
    }
    const loop = (t) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const st of stars) {
        const alpha = 0.6 + 0.4 * Math.sin(st.tw + t * 0.001 * st.s)
        ctx.beginPath()
        ctx.arc(st.x, st.y - scrollY * 0.08, st.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${alpha})`
        ctx.fill()
      }
      rafId = requestAnimationFrame(loop)
    }
    init()
    rafId = requestAnimationFrame(loop)
    const onResize = () => init()
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
    }
  }, [scrollY])

  // Skyline layers
  const layers = useMemo(() => {
    const L = [
      { key: 'back', parallax: 0.18, scale: 0.9, count: 10 },
      { key: 'mid', parallax: 0.35, scale: 1.0, count: 12 },
      { key: 'front', parallax: 0.55, scale: 1.15, count: 8 },
    ]
    const makeBuildings = (count, scale) =>
      Array.from({ length: count }).map(() => ({
        h: 140 + Math.random() * 300 * scale,
        w: 48 + Math.random() * 70 * scale,
        x: Math.random() * 92,
        neon: Math.random() < 0.28,
        flickerDelay: `${Math.floor(Math.random() * 4000)}ms`,
      }))
    return L.map((l) => ({ ...l, buildings: makeBuildings(l.count, l.scale) }))
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
    { to: '/portfolio', label: 'Investments' },
    { to: '/calendar', label: 'Bill payments' },
    { to: '/experiences', label: 'Experiences' },
    
  ]

  return (
    <div className="layout" style={{ '--vh': `${viewport.h}px` }}>
      {/* Urban Noir background layers (non-interactive) */}
      <canvas ref={canvasRef} className="noir-stars" />
      <div className="noir-backdrop" style={{ backgroundImage: `url(${noirBackdrop})`, transform: `translateY(${-(scrollY * 0.12)}px)` }} />
      {/* Plane animation (inline SVG silhouette) */}
      <div className="noir-plane-wrap" style={{ transform: `translateY(${-(scrollY * 0.05)}px)` }}>
        <div className="noir-plane" aria-hidden>
          <svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Plane">
            <g fill="#d9e6ff">
              <path d="M10 55 L70 45 L120 50 L170 40 L190 42 L175 52 L120 60 L70 55 Z" />
              <rect x="70" y="45" width="12" height="10" fill="#bcd3ff" />
              <path d="M85 48 L105 42 L110 44 L90 52 Z" fill="#bcd3ff" />
            </g>
          </svg>
        </div>
      </div>
      {layers.map((layer) => (
        <div
          key={layer.key}
          className={`skyline-layer skyline-${layer.key}`}
          style={{ transform: `translateY(${-(scrollY * layer.parallax)}px)` }}
        >
          {layer.buildings.map((b, idx) => (
            <div key={idx} className="building" style={{ left: `${b.x}%`, height: `${b.h}px`, width: `${b.w}px` }}>
              <div className="face front" />
              <div className="face side" />
              <div className="windows" style={{ animationDelay: b.flickerDelay }} />
              {b.neon && <div className="neon-sign">NOIR</div>}
            </div>
          ))}
        </div>
      ))}
      <header className="layout-header">
        <div className="layout-brand">XIII-LABS</div>
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
          <button
            type="button"
            className="layout-hamburger btn btn-ghost"
            onClick={() => setProfileModalOpen(true)}
            aria-label="Open profile and settings"
          >
            ☰
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
      {/* <AssistantFab /> */}
      <ProfileModal
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={user}
        onUpdate={onUpdate}
      />
      <ChatBar />
    </div>
  )
}
