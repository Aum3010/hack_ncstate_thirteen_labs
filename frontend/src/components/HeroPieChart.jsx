import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Sector, ResponsiveContainer, Tooltip } from 'recharts'
import { getDashboardSummary } from '../api/dashboard'
import { syncWallet } from '../api/wallets'
import './HeroPieChart.css'

const PARTITION_KEYS = ['investments', 'bill_payments', 'short_term_goals']
const LABELS = {
  investments: 'Investments',
  bill_payments: 'Bill Payments',
  short_term_goals: 'Short-term Goals',
}
const COLORS = {
  investments: '#c4a035',
  bill_payments: '#6b2d3a',
  short_term_goals: '#4a5d4a',
}
const EMPTY_RING_FILL = 'rgba(217, 119, 6, 0.25)'

/* DaisyDisk-style active sector renderer -- grows outward on select */
function ActiveShape(props) {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill,
  } = props
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 4}
        outerRadius={outerRadius + 14}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="rgba(217, 119, 6, 0.6)"
        strokeWidth={2}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerRadius + 18}
        outerRadius={outerRadius + 22}
        startAngle={startAngle}
        endAngle={endAngle}
        fill="rgba(217, 119, 6, 0.35)"
      />
    </g>
  )
}

export default function HeroPieChart({ user }) {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)

  const load = () => {
    setLoading(true)
    setError('')
    getDashboardSummary()
      .then(setData)
      .catch((e) => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleSync = async () => {
    const w = data?.wallets?.[0]
    if (!w?.id) return
    setSyncing(true)
    try { await syncWallet(w.id); load() }
    catch (e) { setError(e.message || 'Sync failed') }
    finally { setSyncing(false) }
  }

  const { pieData, totalCents, legendItems, detailMap } = useMemo(() => {
    const partitions = data?.partitions || []
    const targetPcts = data?.target_pcts || {}
    const totalActual = partitions.reduce((s, p) => s + (p.actual_cents || 0), 0)

    const byKey = {}
    partitions.forEach((p) => { byKey[p.key] = p })
    const segments = []
    const legendItems = []
    const detailMap = {}

    PARTITION_KEYS.forEach((key) => {
      const actual = byKey[key]?.actual_cents ?? 0
      const planPct = (targetPcts[key] ?? 100 / PARTITION_KEYS.length) / 100
      const targetCents = totalActual > 0 ? planPct * totalActual : 0
      const fillRatio = targetCents > 0 ? Math.min(1, actual / targetCents) : 0
      const fillAngle = planPct * fillRatio
      const unfillAngle = planPct * (1 - fillRatio)
      const fill = COLORS[key] || '#8888a0'
      const unfill = fill + '40'

      const filledIdx = segments.length
      if (fillAngle > 0.001) {
        segments.push({
          key: `${key}-filled`, partKey: key, name: LABELS[key],
          value: fillAngle, fill, actual_cents: actual, isFilled: true,
        })
        detailMap[filledIdx] = {
          key, name: LABELS[key], actual, targetCents, fillRatio, fill, planPct,
        }
      }
      if (unfillAngle > 0.001) {
        const unfIdx = segments.length
        segments.push({
          key: `${key}-unfilled`, partKey: key, name: `${LABELS[key]} (remaining)`,
          value: unfillAngle, fill: unfill, isFilled: false,
        })
        detailMap[unfIdx] = {
          key, name: LABELS[key], actual, targetCents, fillRatio, fill, planPct,
        }
      }
      legendItems.push({ key, name: LABELS[key], actual_cents: actual, fill })
    })

    const totalCents = totalActual
    if (segments.length === 0) {
      segments.push({ key: 'empty', name: 'No data yet', value: 1, fill: EMPTY_RING_FILL })
    }

    return { pieData: segments, totalCents, legendItems, detailMap }
  }, [data])

  const totalDollars = (totalCents / 100).toFixed(2)
  const hasData = pieData.length > 0 && pieData[0].key !== 'empty'

  const onPieClick = useCallback((_, index) => {
    setActiveIndex((prev) => (prev === index ? -1 : index))
  }, [])

  const onLegendClick = useCallback((partKey) => {
    const idx = pieData.findIndex((s) => s.partKey === partKey && s.isFilled)
    if (idx >= 0) setActiveIndex((prev) => (prev === idx ? -1 : idx))
  }, [pieData])

  const activeDetail = activeIndex >= 0 ? detailMap[activeIndex] : null

  if (loading) {
    return (
      <div className="hero-pie">
        <div className="hero-loading">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="hero-pie">
        <div className="hero-error">{error}</div>
        <button type="button" className="btn btn-ghost" onClick={load}>Retry</button>
      </div>
    )
  }

  return (
    <div className="hero-pie">
      <div className="hero-pie-header">
        <span className="hero-title">Your Financial View</span>
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
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius="28%"
              outerRadius="46%"
              paddingAngle={hasData ? 2 : 0}
              dataKey="value"
              stroke="rgba(217, 119, 6, 0.2)"
              strokeWidth={1}
              activeIndex={activeIndex >= 0 ? activeIndex : undefined}
              activeShape={ActiveShape}
              onClick={onPieClick}
            >
              {pieData.map((entry) => (
                <Cell key={entry.key} fill={entry.fill || EMPTY_RING_FILL} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#1f1f24',
                border: '1px solid #3d2914',
                borderRadius: '6px',
                color: '#e8e8ed',
                fontSize: '0.85rem',
              }}
              formatter={(val, name, props) => {
                const p = props.payload
                if (p.actual_cents != null && p.isFilled) {
                  return [`$${(p.actual_cents / 100).toFixed(2)}`, p.name]
                }
                return [null, null]
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="hero-pie-center">
          <span className="hero-total">${totalDollars}</span>
          <span className="hero-sublabel">this month</span>
        </div>
      </div>

      <div className="hero-legend-inline">
        {legendItems.map((p) => (
          <div
            key={p.key}
            className={`hero-legend-item${activeDetail?.key === p.key ? ' active' : ''}`}
            onClick={() => onLegendClick(p.key)}
          >
            <span className="hero-dot" style={{ background: p.fill }} />
            <span>{p.name}: ${((p.actual_cents || 0) / 100).toFixed(2)}</span>
          </div>
        ))}
      </div>

      {activeDetail && (
        <div className="hero-detail-panel">
          <h4 className="hero-detail-title">{activeDetail.name}</h4>
          <div className="hero-detail-row">
            <span className="hero-detail-label">Actual</span>
            <span className="hero-detail-value">${(activeDetail.actual / 100).toFixed(2)}</span>
          </div>
          <div className="hero-detail-row">
            <span className="hero-detail-label">Target</span>
            <span className="hero-detail-value">${(activeDetail.targetCents / 100).toFixed(2)}</span>
          </div>
          <div className="hero-detail-row">
            <span className="hero-detail-label">Allocation</span>
            <span className="hero-detail-value">{(activeDetail.planPct * 100).toFixed(0)}%</span>
          </div>
          <div className="hero-detail-bar">
            <div
              className="hero-detail-bar-fill"
              style={{
                width: `${(activeDetail.fillRatio * 100).toFixed(1)}%`,
                background: activeDetail.fill,
              }}
            />
          </div>
          {activeDetail.key === 'short_term_goals' && (
            <button
              type="button"
              className="hero-detail-action btn btn-ghost"
              onClick={() => navigate('/experiences')}
              style={{ marginTop: '0.5rem' }}
            >
              View Experiences
            </button>
          )}
          <button
            type="button"
            className="hero-detail-close"
            onClick={() => setActiveIndex(-1)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}
