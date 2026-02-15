import React, { useState, useEffect, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { portfolioChat } from '../api/portfolio'
import { listGoals } from '../api/goals'
import './Portfolio.css'

const RISK_OPTIONS = [
  { value: 'conservative', label: 'Conservative' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'aggressive', label: 'Aggressive' },
]

export default function Portfolio() {
  // --- Manual allocation state (top-left) ---
  const INCOME = 10000
  const COLORS = {
    stocks: '#10b981',
    roth: '#8b5cf6',
    _401k: '#3b82f6',
    hysa: '#f59e0b',
    gold: '#d97706',
  }
  const RISKS = {
    stocks: 85,
    roth: 60,
    _401k: 50,
    hysa: 10,
    gold: 25,
  }
  const YIELD_BY_MODE = {
    conservative: { stocks: 0.06, roth: 0.05, _401k: 0.05, hysa: 0.04, gold: 0.025 },
    balanced: { stocks: 0.08, roth: 0.06, _401k: 0.06, hysa: 0.045, gold: 0.03 },
    aggressive: { stocks: 0.10, roth: 0.07, _401k: 0.07, hysa: 0.045, gold: 0.035 },
  }
  const INVEST_PCT_BY_MODE = {
    conservative: 0.20,
    balanced: 0.30,
    aggressive: 0.40,
  }
  const PRESETS = {
    conservative: { stocks: 10, roth: 20, _401k: 30, hysa: 25, gold: 15 },
    balanced: { stocks: 25, roth: 20, _401k: 25, hysa: 15, gold: 15 },
    aggressive: { stocks: 40, roth: 25, _401k: 20, hysa: 5, gold: 10 },
  }

  const [risk, setRisk] = useState('balanced')
  const [hasLongTermGoal, setHasLongTermGoal] = useState(false)
  const [alloc, setAlloc] = useState(PRESETS.balanced)

  // --- Spending analysis removed; focusing on investment summary ---

  // --- Chat state (bottom) ---
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [explainedOnce, setExplainedOnce] = useState(false)

  // No spending analysis fetch

  // --- Allocation handlers ---
  // Load goals to check if any long-term goal exists
  useEffect(() => {
    listGoals()
      .then((gs) => setHasLongTermGoal(gs.some((g) => (g.category || '').toLowerCase().includes('long'))))
      .catch(() => setHasLongTermGoal(false))
  }, [])

  const applyPreset = (mode) => {
    const base = { ...PRESETS[mode] }
    if (hasLongTermGoal) {
      // Nudge toward retirement accounts when long-term goals exist
      base.roth = Math.min(100, base.roth + 5)
      base._401k = Math.min(100, base._401k + 5)
      // Reduce stocks to compensate if total exceeds 100
      const total = base.stocks + base.roth + base._401k + base.hysa + base.gold
      if (total > 100) {
        base.stocks = Math.max(0, base.stocks - (total - 100))
      }
    }
    setAlloc(base)
  }

  const onLeverChange = (key, nextVal) => {
    nextVal = Math.max(0, Math.min(100, Math.round(nextVal)))
    const others = Object.keys(alloc).filter((k) => k !== key)
    const sumOthers = others.reduce((acc, k) => acc + alloc[k], 0)
    let next = { ...alloc, [key]: nextVal }
    const remaining = 100 - nextVal
    if (sumOthers <= 0) {
      // distribute evenly across others
      const even = Math.floor(remaining / others.length)
      others.forEach((k) => { next[k] = even })
      // fix rounding to hit 100
      const fix = 100 - Object.values(next).reduce((a, b) => a + b, 0)
      if (fix !== 0 && others[0]) next[others[0]] += fix
    } else {
      // scale others proportionally to fill remaining
      let accSum = 0
      others.forEach((k, idx) => {
        const scaled = Math.round((alloc[k] / sumOthers) * remaining)
        next[k] = scaled
        accSum += scaled
        // adjust the last one to fix rounding drift
        if (idx === others.length - 1) {
          const drift = 100 - (nextVal + accSum)
          next[k] = Math.max(0, next[k] + drift)
        }
      })
    }
    setAlloc(next)
  }

  const pieData = useMemo(() => {
    return [
      { key: 'stocks', name: 'Stocks', value: alloc.stocks, fill: COLORS.stocks },
      { key: 'roth', name: 'Roth IRA', value: alloc.roth, fill: COLORS.roth },
      { key: '_401k', name: '401K', value: alloc._401k, fill: COLORS._401k },
      { key: 'hysa', name: 'HYSA', value: alloc.hysa, fill: COLORS.hysa },
      { key: 'gold', name: 'Gold Bond', value: alloc.gold, fill: COLORS.gold },
    ]
  }, [alloc])

  // --- Chat handlers ---
  const sendChat = async () => {
    const msg = chatInput.trim()
    if (!msg) return
    const userMsg = { role: 'user', text: msg }
    setMessages((prev) => [...prev, userMsg])
    setChatInput('')
    setChatLoading(true)
    try {
      const data = await portfolioChat(msg, risk)
      setMessages((prev) => [...prev, { role: 'assistant', text: data.text || 'No response.' }])
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Error: ' + err.message }])
    } finally {
      setChatLoading(false)
    }
  }

  const explainChart = async () => {
    const lines = [
      `Mode: ${risk}`,
      `Income: $${INCOME.toFixed(2)}`,
      `Allocations:`,
      `- Stocks: ${alloc.stocks}%`,
      `- Roth IRA: ${alloc.roth}%`,
      `- 401K: ${alloc._401k}%`,
      `- HYSA: ${alloc.hysa}%`,
      `- Gold Bond: ${alloc.gold}%`,
      `Weighted 1y yield estimate: ${(weightedRate * 100).toFixed(2)}%`,
    ]
    const prompt = `Please explain the user's portfolio pie chart based on the following details and provide concise guidance on diversification and risk for a ${risk} investor. Keep it under 150 words.\n\n${lines.join('\n')}`
    setChatLoading(true)
    try {
      const data = await portfolioChat(prompt, risk)
      setMessages((prev) => [...prev, { role: 'assistant', text: data.text || 'No response.' }])
      setExplainedOnce(true)
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Error: ' + err.message }])
    } finally {
      setChatLoading(false)
    }
  }

  useEffect(() => {
    if (!explainedOnce && pieData.length > 0) {
      explainChart()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [risk, alloc])

  // --- Savings progress removed; page focused on investment summary ---

  const weightedRate = useMemo(() => {
    const y = YIELD_BY_MODE[risk]
    if (!y) return 0
    const parts = [
      (alloc.stocks || 0) * (y.stocks || 0),
      (alloc.roth || 0) * (y.roth || 0),
      (alloc._401k || 0) * (y._401k || 0),
      (alloc.hysa || 0) * (y.hysa || 0),
      (alloc.gold || 0) * (y.gold || 0),
    ]
    return parts.reduce((a, b) => a + b, 0) / 100
  }, [alloc, risk])

  return (
    <div className="portfolio-page">
      <h1 className="page-title">Portfolio</h1>

      {/* ========== TOP HALF ========== */}
      <div className="portfolio-top">

        {/* --- TOP LEFT: Allocation Pie Chart --- */}
        <div className="portfolio-top-left card">
          <h2 className="section-title">Portfolio Allocation</h2>
          <div className="portfolio-goal-row">
            <select
              className="input portfolio-risk-select"
              value={risk}
              onChange={(e) => setRisk(e.target.value)}
              aria-label="Risk tolerance"
            >
              {RISK_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button type="button" className="btn btn-primary" onClick={() => applyPreset(risk)}>
              Apply Preset
            </button>
          </div>
          {pieData.length > 0 ? (
            <div className="portfolio-pie-wrap">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    label={({ name, value }) => `${name} ${value}%`}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : null}
          <div className="portfolio-levers">
            {pieData.map((row) => (
              <div key={row.key} className="portfolio-lever-row">
                <div className="portfolio-lever-header">
                  <span className="portfolio-lever-name">{row.name}</span>
                  <span className="portfolio-lever-risk">Risk {RISKS[row.key]}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={alloc[row.key]}
                  onChange={(e) => onLeverChange(row.key, Number(e.target.value))}
                />
                <div className="portfolio-lever-stats">
                  <span className="portfolio-lever-pct">{alloc[row.key]}%</span>
                  <span className="portfolio-lever-amt">${((alloc[row.key] / 100) * INCOME).toFixed(2)}</span>
                </div>
              </div>
            ))}
            <div className="portfolio-allocation-summary">
              <span>Total: {Object.values(alloc).reduce((a, b) => a + b, 0)}%</span>
              <span>Income: ${INCOME.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* --- TOP RIGHT: Investment Summary + Chart Q&A --- */}
        <div className="portfolio-top-right">
          {/* Investment Summary */}
          <div className="card portfolio-investment-card">
            <h2 className="section-title">Investment Summary</h2>
            {(() => {
              const investPct = INVEST_PCT_BY_MODE[risk] || 0
              const invested = INCOME * investPct
              const returns = invested * weightedRate
              const projected = invested + returns
              return (
                <ul className="portfolio-savings-list">
                  <li className="portfolio-savings-item">
                    <div className="portfolio-savings-header">
                      <span>Mode: {risk.charAt(0).toUpperCase() + risk.slice(1)}</span>
                      <span className="portfolio-savings-pct">Invest {Math.round(investPct * 100)}% of income</span>
                    </div>
                    <div className="portfolio-savings-amounts">
                      <span>Invested value: ${invested.toFixed(2)}</span>
                    </div>
                    <div className="portfolio-savings-projections">
                      <span>Returns (1y): ${returns.toFixed(2)}</span>
                      <span>Gross value projected (1y): ${projected.toFixed(2)}</span>
                    </div>
                  </li>
                </ul>
              )
            })()}
          </div>

          {/* Chart Explanation & Q&A (Gemini) */}
          <div className="card portfolio-explain-card">
            <h2 className="section-title">Chart Explanation & Q&A</h2>
            <div className="portfolio-chat-messages">
              {messages.length === 0 && (
                <p className="text-muted portfolio-chat-empty">Generating overview of your allocation...</p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`portfolio-chat-msg portfolio-chat-${m.role}`}>
                  <span className="portfolio-chat-role">{m.role === 'user' ? 'You' : 'Advisor'}</span>
                  <p className="portfolio-chat-text">{m.text}</p>
                </div>
              ))}
              {chatLoading && (
                <div className="portfolio-chat-msg portfolio-chat-assistant">
                  <span className="portfolio-chat-role">Advisor</span>
                  <p className="portfolio-chat-text text-muted">Thinking...</p>
                </div>
              )}
            </div>
            <div className="portfolio-chat-input-row">
              <input
                className="input"
                placeholder="Ask about this allocation..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
              />
              <button type="button" className="btn btn-secondary" onClick={explainChart} disabled={chatLoading}>
                Explain Chart
              </button>
              <button type="button" className="btn btn-primary" onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>
                {chatLoading ? '...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom section removed; Q&A moved under Investment Summary */}
    </div>
  )
}
