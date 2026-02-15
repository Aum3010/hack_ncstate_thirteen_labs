import React, { useState, useEffect, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { getProfile } from '../api/users'
import { portfolioChat, getPortfolioAllocation, getSpendingAnalysis } from '../api/portfolio'
import { listGoals } from '../api/goals'
import { listTransactions } from '../api/transactions'
import './Portfolio.css'

const RISK_OPTIONS = [
  { value: 'conservative', label: 'Conservative' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'aggressive', label: 'Aggressive' },
]

/** Map LLM category name to our 5-bucket key */
function mapCategoryToBucket(name) {
  const n = (name || '').toLowerCase()
  if (n.includes('roth') || n.includes('ira')) return 'roth'
  if (n.includes('401') || n.includes('k)')) return '_401k'
  if (n.includes('hysa') || n.includes('cash') || n.includes('savings')) return 'hysa'
  if (n.includes('gold') || n.includes('bond') || n.includes('real estate')) return 'gold'
  return 'stocks'
}

export default function Portfolio() {
  // --- Manual allocation state (top-left) ---
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
  const [profileGoal, setProfileGoal] = useState('')
  const [income, setIncome] = useState(null) // from profile, transactions, or 10000 fallback
  const [spendingSuggestions, setSpendingSuggestions] = useState([])
  const [allocationLoading, setAllocationLoading] = useState(false)

  // --- Chat state (bottom) ---
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  // Removed parallax scroll handling; content now starts below navbar

  // No spending analysis fetch

  // --- Load profile on mount: risk_tolerance, goals, income; then fetch LLM allocation ---
  useEffect(() => {
    const parseIncome = (val) => {
      if (val == null) return null
      if (typeof val === 'number' && val > 0) return val
      const s = String(val).replace(/,/g, '').trim()
      const match = s.match(/[\d.]+/)
      return match ? parseFloat(match) : null
    }

    Promise.all([getProfile(), listTransactions({ limit: 200 })])
      .then(([user, txData]) => {
        if (!user) return
        const pq = user.profile_questionnaire || {}
        const oa = user.onboarding_answers || {}

        const r = (pq.risk_tolerance || oa.risk_tolerance || '').toLowerCase()
        const validRisk = r === 'conservative' || r === 'balanced' || r === 'aggressive'
        if (validRisk) {
          setRisk(r)
          setAlloc(PRESETS[r] || PRESETS.balanced)
        }

        const goal = (pq.long_term_goal || pq.short_term_goal || oa.main_focus || '').trim()
        if (goal) setProfileGoal(goal)

        let inc = parseIncome(pq.income)
        if (inc == null) {
          const txs = txData?.transactions || []
          const now = new Date()
          const thisMonth = txs.filter((t) => {
            const d = t.transaction_at ? new Date(t.transaction_at) : null
            return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
          })
          const derived = thisMonth
            .filter((t) => (Number(t.amount_cents) || 0) > 0)
            .reduce((sum, t) => sum + (Number(t.amount_cents) || 0) / 100, 0)
          inc = derived > 0 ? Math.round(derived) : null
        }
        setIncome(inc ?? 10000)

        // Fetch LLM allocation with profile goal and risk
        setAllocationLoading(true)
        getPortfolioAllocation(goal || 'general growth and retirement', validRisk ? r : 'balanced')
          .then((data) => {
            const cats = data?.categories
            if (Array.isArray(cats) && cats.length > 0) {
              const aggregated = { stocks: 0, roth: 0, _401k: 0, hysa: 0, gold: 0 }
              for (const c of cats) {
                const key = mapCategoryToBucket(c.name)
                const pct = Math.round(Number(c.percentage) || 0)
                if (aggregated[key] !== undefined) aggregated[key] += pct
              }
              const total = Object.values(aggregated).reduce((a, b) => a + b, 0)
              if (total > 0) {
                let remainder = 100 - total
                const keys = Object.keys(aggregated)
                for (let i = 0; i < keys.length && remainder !== 0; i++) {
                  const k = keys[i]
                  const add = remainder > 0 ? 1 : -1
                  aggregated[k] = Math.max(0, Math.min(100, aggregated[k] + add))
                  remainder -= add
                }
                setAlloc(aggregated)
              }
            }
          })
          .catch(() => {})
          .finally(() => setAllocationLoading(false))
      })
      .catch(() => {})
  }, [])

  // --- Load spending analysis on mount ---
  useEffect(() => {
    getSpendingAnalysis()
      .then((data) => setSpendingSuggestions(data?.suggestions || []))
      .catch(() => setSpendingSuggestions([]))
  }, [])

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
    const userMessage = { role: 'user', content: msg }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setChatInput('')
    setChatLoading(true)
    try {
      const [txData, goals] = await Promise.all([
        listTransactions({ limit: 200 }),
        listGoals().catch(() => []),
      ])
      const transactions = txData?.transactions || []
      const spendingByCategory = {}
      for (const transaction of transactions) {
        const cents = Number(transaction.amount_cents || 0)
        if (cents <= 0) continue
        const category = transaction.category || 'other'
        spendingByCategory[category] = (spendingByCategory[category] || 0) + cents
      }

      const payload = {
        messages: nextMessages,
        question: msg,
        risk,
        portfolio: {
          risk,
          allocation: pieData.map((item) => ({ category: item.name, percentage: item.value })),
        },
        spending: Object.entries(spendingByCategory).map(([category, amountCents]) => ({
          category,
          amount_cents: amountCents,
        })),
        savings: goals,
      }

      const data = await portfolioChat(payload)
      setMessages((prev) => [...prev, { role: 'assistant', content: data.text || 'No response.' }])
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Error: ' + err.message }])
    } finally {
      setChatLoading(false)
    }
  }

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
    <div className="portfolio-page portfolio-urban">
      <div className="portfolio-scroll-container">
        <div className="portfolio-hud">
          <div className="portfolio-hud-title-card card">
            <h1 className="portfolio-urban-title">URBAN NOIR</h1>
            <p className="portfolio-urban-subtitle">Investments – scroll to ascend above the city.</p>
          </div>

          <div className="portfolio-top">

        {/* --- TOP LEFT: Allocation Pie Chart --- */}
        <div className="portfolio-top-left card">
          <h2 className="section-title">Portfolio Allocation</h2>
          <div className="portfolio-goal-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <select
              className="input portfolio-risk-select"
              value={risk}
              onChange={(e) => {
                const nextRisk = e.target.value
                setRisk(nextRisk)
                applyPreset(nextRisk)
              }}
              aria-label="Risk tolerance"
            >
              {RISK_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setAllocationLoading(true)
                getPortfolioAllocation(profileGoal || 'general growth and retirement', risk)
                  .then((data) => {
                    const cats = data?.categories
                    if (Array.isArray(cats) && cats.length > 0) {
                      const aggregated = { stocks: 0, roth: 0, _401k: 0, hysa: 0, gold: 0 }
                      for (const c of cats) {
                        const key = mapCategoryToBucket(c.name)
                        const pct = Math.round(Number(c.percentage) || 0)
                        if (aggregated[key] !== undefined) aggregated[key] += pct
                      }
                      const total = Object.values(aggregated).reduce((a, b) => a + b, 0)
                      if (total > 0) {
                        let remainder = 100 - total
                        const keys = Object.keys(aggregated)
                        for (let i = 0; i < keys.length && remainder !== 0; i++) {
                          const k = keys[i]
                          const add = remainder > 0 ? 1 : -1
                          aggregated[k] = Math.max(0, Math.min(100, aggregated[k] + add))
                          remainder -= add
                        }
                        setAlloc(aggregated)
                      }
                    }
                  })
                  .catch(() => {})
                  .finally(() => setAllocationLoading(false))
              }}
              disabled={allocationLoading}
            >
              {allocationLoading ? 'Loading...' : 'Ask advisor'}
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
                  <span className="portfolio-lever-amt">${((alloc[row.key] / 100) * (income ?? 10000)).toFixed(2)}</span>
                </div>
              </div>
            ))}
            <div className="portfolio-allocation-summary">
              <span>Total: {Object.values(alloc).reduce((a, b) => a + b, 0)}%</span>
              <span>Income: ${(income ?? 10000).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* --- TOP RIGHT: Investment Summary + Chart Q&A --- */}
        <div className="portfolio-top-right">
          {/* Spending suggestions (from LLM) */}
          {spendingSuggestions.length > 0 && (
            <div className="card portfolio-spending-card">
              <h2 className="section-title">Spending suggestions</h2>
              <ul className="portfolio-savings-list">
                {spendingSuggestions.slice(0, 4).map((s, i) => (
                  <li key={i} className="portfolio-savings-item">
                    <span className="portfolio-suggestion-cat">{s.category}</span>
                    <p className="text-muted" style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>{s.message}</p>
                    {s.save_amount > 0 && (
                      <span className="portfolio-save-amt">Save ~${s.save_amount.toFixed(0)}/mo</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Investment Summary */}
          <div className="card portfolio-investment-card">
            <h2 className="section-title">Investment Summary</h2>
            {(() => {
              const investPct = INVEST_PCT_BY_MODE[risk] || 0
              const invested = (income ?? 10000) * investPct
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
              {messages.length === 0 && !chatLoading && (
                <p className="text-muted portfolio-chat-empty">Ask about your spending, savings, or portfolio goals.</p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`portfolio-chat-msg portfolio-chat-${m.role}`}>
                  <span className="portfolio-chat-role">{m.role === 'user' ? 'You' : 'Advisor'}</span>
                  <p className="portfolio-chat-text">{m.content}</p>
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
              <button type="button" className="btn btn-primary" onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>
                {chatLoading ? '...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
      </div>
    </div>
  )
}
