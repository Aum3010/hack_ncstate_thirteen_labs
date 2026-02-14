import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { listBills } from '../api/bills'
import { listTransactions } from '../api/transactions'
import { listWallets, syncWallet } from '../api/wallets'
import { getReminders } from '../api/reminders'
import WalletConnect from '../components/WalletConnect'
import HeroPieChart from '../components/HeroPieChart'
import InsightsPanel from '../components/InsightsPanel'
import './Dashboard.css'

const CATEGORY_COLORS = {
  investments: '#10b981',
  bill_payments: '#f59e0b',
  short_term_goals: '#8b5cf6',
  Uncategorized: '#6b7280',
}

export default function Dashboard({ user }) {
  const [bills, setBills] = useState([])
  const [transactions, setTransactions] = useState([])
  const [wallets, setWallets] = useState([])
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    Promise.all([listBills(), listTransactions(), listWallets(), getReminders(7)])
      .then(([b, t, w, r]) => {
        setBills(b)
        setTransactions(t)
        setWallets(w)
        setReminders(r)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const onSyncSolana = async () => {
    if (!wallets?.[0]) return
    setSyncing(true)
    setError('')
    try {
      await syncWallet(wallets[0].id)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  const pieData = React.useMemo(() => {
    const byCat = {}
    for (const t of transactions) {
      const cat = t.category || 'Uncategorized'
      byCat[cat] = (byCat[cat] || 0) + (t.amount_cents || 0)
    }
    const labels = { investments: 'Investments', bill_payments: 'Bill payments', short_term_goals: 'Short-term goals' }
    return Object.entries(byCat).map(([name, value]) => ({ name: labels[name] || name, value, rawName: name }))
  }, [transactions])

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
        <h2 className="section-title">Budget by category</h2>
        <div style={{ height: 260, minHeight: 260 }}>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.rawName || entry.name} fill={CATEGORY_COLORS[entry.rawName] || CATEGORY_COLORS[entry.name] || CATEGORY_COLORS.Uncategorized} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `$${(v / 100).toFixed(2)}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted" style={{ paddingTop: 80 }}>No transactions yet. Sync Solana or add transactions to see your budget breakdown.</p>
          )}
        </div>
      </section>
      <section className="dashboard-section card">
        <h2 className="section-title">Wallet</h2>
        {user?.has_wallet || wallets?.length > 0 ? (
          <div>
            <p className="text-muted">Connected: {wallets?.[0]?.address?.slice(0, 8)}...{wallets?.[0]?.address?.slice(-6)}</p>
            {wallets?.length > 0 && (
              <button type="button" className="btn btn-primary" onClick={onSyncSolana} disabled={syncing}>
                {syncing ? 'Syncing...' : 'Sync Solana'}
              </button>
            )}
            {error && <div className="auth-error">{error}</div>}
          </div>
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
