import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { listBills } from '../api/bills'
import { listTransactions } from '../api/transactions'
import { listWallets } from '../api/wallets'
import { getReminders } from '../api/reminders'
import WalletConnect from '../components/WalletConnect'
import HeroPieChart from '../components/HeroPieChart'
import InsightsPanel from '../components/InsightsPanel'
import './Dashboard.css'

export default function Dashboard({ user }) {
  const [bills, setBills] = useState([])
  const [transactions, setTransactions] = useState([])
  const [wallets, setWallets] = useState([])
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([listBills(), listTransactions(), listWallets(), getReminders(7)])
      .then(([b, t, w, r]) => {
        setBills(b)
        setTransactions(t)
        setWallets(w)
        setReminders(r)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const upcomingBills = bills
    .filter((b) => !b.paid_at)
    .slice(0, 5)

  if (loading) {
    return <div className="page-loading">Loading...</div>
  }

  return (
    <div className="dashboard">
      <h1 className="page-title">Dashboard</h1>
      <HeroPieChart user={user} />
      <InsightsPanel />
      <section className="dashboard-section card">
        <h2 className="section-title">Wallet</h2>
        {user?.has_wallet || wallets?.length > 0 ? (
          <p className="text-muted">Connected: {wallets?.[0]?.address?.slice(0, 8)}...{wallets?.[0]?.address?.slice(-6)}</p>
        ) : (
          <WalletConnect onConnect={() => window.location.reload()} />
        )}
      </section>
      {reminders.length > 0 && (
        <section className="dashboard-section card reminders-card">
          <h2 className="section-title">Reminders (next 7 days)</h2>
          <ul className="bill-list-mini">
            {reminders.map((b) => (
              <li key={b.id}>
                <Link to="/bills">{b.name}</Link>
                <span>${(b.amount_cents / 100).toFixed(2)}</span>
                <span className="due">{b.due_date}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="dashboard-section card">
        <h2 className="section-title">Upcoming bills</h2>
        {upcomingBills.length === 0 ? (
          <p className="text-muted">No upcoming bills. <Link to="/bills">Add a bill</Link>.</p>
        ) : (
          <ul className="bill-list-mini">
            {upcomingBills.map((b) => (
              <li key={b.id}>
                <Link to="/bills">{b.name}</Link>
                <span>${(b.amount_cents / 100).toFixed(2)}</span>
                {b.due_date && <span className="due">{b.due_date}</span>}
              </li>
            ))}
          </ul>
        )}
        <Link to="/bills" className="link-neon">View all bills →</Link>
      </section>
      <section className="dashboard-section card">
        <h2 className="section-title">Recent transactions</h2>
        {transactions.length === 0 ? (
          <p className="text-muted">No transactions yet. Add via Money or the assistant.</p>
        ) : (
          <ul className="tx-list-mini">
            {transactions.slice(0, 5).map((t) => (
              <li key={t.id}>
                <span className="category">{t.category || 'Uncategorized'}</span>
                <span className="amount">${(t.amount_cents / 100).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/money" className="link-neon">Money & Crypto →</Link>
      </section>
    </div>
  )
}
