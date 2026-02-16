import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { listBills } from '../api/bills'
import { listTransactions } from '../api/transactions'
import './Risk.css'

export default function Risk() {
  const [bills, setBills] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([listBills(), listTransactions()])
      .then(([b, t]) => {
        setBills(b)
        setTransactions(t.transactions || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const monthlyBills = bills
    .filter((b) => !b.paid_at)
    .reduce((sum, b) => sum + b.amount_cents, 0)
  const monthlySpend = transactions
    .filter((t) => t.amount_cents < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount_cents), 0)
  const monthlyReceived = transactions
    .filter((t) => t.amount_cents > 0)
    .reduce((sum, t) => sum + t.amount_cents, 0)

  if (loading) return <div className="page-loading">Loading...</div>

  return (
    <div className="risk-page">
      <h1 className="page-title">Investments</h1>
      <section className="risk-section risk-card">
        <h2 className="section-title">Loan / obligations</h2>
        <p className="text-muted">Upcoming bill obligations (from Bill Payments). Loan risk view can pull from the same data.</p>
        <div className="risk-stat">
          <span className="risk-label">Monthly bill total (unpaid)</span>
          <span className="risk-value neon-pink">${(monthlyBills / 100).toFixed(2)}</span>
        </div>
        <p style={{ marginTop: '0.75rem' }}>
          <Link to="/calendar" className="link-neon">View bills and calendar</Link>
        </p>
      </section>
      <section className="risk-section risk-card">
        <h2 className="section-title">Financial risks</h2>
        <p className="text-muted">Runway and concentration risk (Valkey orderbook, wallet balance) — Phase D.</p>
        <div className="risk-stat">
          <span className="risk-label">Spend (from transactions)</span>
          <span className="risk-value neon-green">${(monthlySpend / 100).toFixed(2)}</span>
        </div>
        <div className="risk-stat">
          <span className="risk-label">Received</span>
          <span className="risk-value">${(monthlyReceived / 100).toFixed(2)}</span>
        </div>
      </section>
    </div>
  )
}
