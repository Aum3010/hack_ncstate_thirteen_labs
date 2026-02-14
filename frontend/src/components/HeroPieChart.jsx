import React, { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { getDashboardSummary } from '../api/dashboard'
import { syncWallet } from '../api/wallets'
import './HeroPieChart.css'

export default function HeroPieChart({ user }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    getDashboardSummary()
      .then(setData)
      .catch((e) => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const handleSync = async () => {
    const w = data?.wallets?.[0]
    if (!w?.id) return
    setSyncing(true)
    try {
      await syncWallet(w.id)
      load()
    } catch (e) {
      setError(e.message || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="hero-pie hero-card card">
        <div className="hero-loading">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="hero-pie hero-card card">
        <div className="hero-error">{error}</div>
        <button type="button" className="btn btn-ghost" onClick={load}>Retry</button>
      </div>
    )
  }

  const partitions = data?.partitions || []
  const totalCents = data?.total_actual_cents || 0
  const totalDollars = (totalCents / 100).toFixed(2)
  const hasData = partitions.some((p) => p.value > 0)

  return (
    <div className="hero-pie hero-card card">
      <div className="hero-pie-header">
        <h2 className="hero-title">Your financial view</h2>
        {data?.wallets?.length > 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? 'Syncing...' : 'Sync Solana'}
          </button>
        )}
      </div>
      <div className="hero-pie-chart-wrap">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={hasData ? partitions : [{ name: 'No data yet', value: 1, fill: 'var(--border)', key: 'empty' }]}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={hasData ? 2 : 0}
              dataKey="value"
            >
              {(hasData ? partitions : [{ key: 'empty', fill: 'var(--border)' }]).map((entry) => (
                <Cell key={entry.key} fill={entry.fill || 'var(--border)'} />
              ))}
            </Pie>
            <Tooltip
              formatter={(val, name, props) => {
                const p = props.payload
                if (p.actual_cents != null) {
                  return [`$${(p.actual_cents / 100).toFixed(2)} actual`, p.name]
                }
                return [val, name]
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
        <div className="hero-pie-center">
          <span className="hero-total">${totalDollars}</span>
          <span className="hero-sublabel">this month</span>
        </div>
      </div>
      <div className="hero-legend-inline">
        {partitions.map((p) => (
          <div key={p.key} className="hero-legend-item">
            <span className="hero-dot" style={{ background: p.fill }} />
            <span>{p.name}: ${((p.actual_cents || 0) / 100).toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
