import React, { useState, useEffect, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { getPortfolioAllocation, getSpendingAnalysis, portfolioChat } from '../api/portfolio'
import './Portfolio.css'

const RISK_OPTIONS = [
  { value: 'conservative', label: 'Conservative' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'aggressive', label: 'Aggressive' },
]

export default function Portfolio() {
  // --- Allocation state (top-left) ---
  const [goalInput, setGoalInput] = useState('')
  const [risk, setRisk] = useState('balanced')
  const [allocation, setAllocation] = useState(null)
  const [allocLoading, setAllocLoading] = useState(false)
  const [allocError, setAllocError] = useState('')

  // --- Spending analysis state (top-right) ---
  const [analysis, setAnalysis] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(true)

  // --- Chat state (bottom) ---
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  // Load spending analysis on mount
  useEffect(() => {
    getSpendingAnalysis()
      .then(setAnalysis)
      .catch(() => setAnalysis(null))
      .finally(() => setAnalysisLoading(false))
  }, [])

  // --- Allocation handlers ---
  const handleGenerateAllocation = async (e) => {
    e.preventDefault()
    if (!goalInput.trim()) return
    setAllocLoading(true)
    setAllocError('')
    try {
      const data = await getPortfolioAllocation(goalInput.trim(), risk)
      setAllocation(data)
    } catch (err) {
      setAllocError(err.message)
    } finally {
      setAllocLoading(false)
    }
  }

  const pieData = useMemo(() => {
    if (!allocation?.categories) return []
    return allocation.categories.map((c) => ({
      name: c.name,
      value: c.percentage,
      fill: c.color,
    }))
  }, [allocation])

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

  // --- Savings progress ---
  const savings = analysis?.savings || []
  const suggestions = analysis?.suggestions || []

  return (
    <div className="portfolio-page">
      <h1 className="page-title">Portfolio</h1>

      {/* ========== TOP HALF ========== */}
      <div className="portfolio-top">

        {/* --- TOP LEFT: Allocation Pie Chart --- */}
        <div className="portfolio-top-left card">
          <h2 className="section-title">Portfolio Allocation</h2>
          <form className="portfolio-goal-form" onSubmit={handleGenerateAllocation}>
            <input
              className="input"
              placeholder="What are you saving/investing for?"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
            />
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
              <button type="submit" className="btn btn-primary" disabled={allocLoading || !goalInput.trim()}>
                {allocLoading ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </form>
          {allocError && <div className="portfolio-error">{allocError}</div>}
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
          ) : (
            <p className="text-muted portfolio-pie-placeholder">
              Enter your investment goal above to generate a personalized allocation.
            </p>
          )}
        </div>

        {/* --- TOP RIGHT: Savings Progress + AI Suggestions --- */}
        <div className="portfolio-top-right">
          {/* Savings progress */}
          <div className="card portfolio-savings-card">
            <h2 className="section-title">Savings Progress</h2>
            {analysisLoading ? (
              <p className="text-muted">Loading...</p>
            ) : savings.length === 0 ? (
              <p className="text-muted">No savings goals yet. Add goals on the Dashboard.</p>
            ) : (
              <ul className="portfolio-savings-list">
                {savings.map((g) => (
                  <li key={g.id} className="portfolio-savings-item">
                    <div className="portfolio-savings-header">
                      <span>{g.name}</span>
                      <span className="portfolio-savings-pct">{g.progress_pct}%</span>
                    </div>
                    <div className="portfolio-progress-bar">
                      <div
                        className="portfolio-progress-fill"
                        style={{ width: `${Math.min(g.progress_pct, 100)}%` }}
                      />
                    </div>
                    <div className="portfolio-savings-amounts">
                      <span>${g.saved.toFixed(2)}</span>
                      <span className="text-muted">/ ${g.target.toFixed(2)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* AI Suggestions */}
          <div className="card portfolio-suggestions-card">
            <h2 className="section-title">AI Suggestions</h2>
            {analysisLoading ? (
              <p className="text-muted">Analyzing spending...</p>
            ) : suggestions.length === 0 ? (
              <p className="text-muted">Add transactions to receive personalized suggestions.</p>
            ) : (
              <ul className="portfolio-suggestions-list">
                {suggestions.map((s, i) => (
                  <li key={i} className="portfolio-suggestion-item">
                    <span className="portfolio-suggestion-cat">{s.category}</span>
                    <p className="portfolio-suggestion-msg">{s.message}</p>
                    {s.save_amount > 0 && (
                      <span className="portfolio-suggestion-save">
                        Potential savings: ${s.save_amount.toFixed(2)}/mo
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ========== BOTTOM HALF: Chat ========== */}
      <div className="portfolio-bottom card">
        <h2 className="section-title">Portfolio Agent</h2>
        <div className="portfolio-chat-messages">
          {messages.length === 0 && (
            <p className="text-muted portfolio-chat-empty">
              Ask about your portfolio, allocation strategy, or spending habits.
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`portfolio-chat-msg portfolio-chat-${m.role}`}>
              <span className="portfolio-chat-role">{m.role === 'user' ? 'You' : 'Agent'}</span>
              <p className="portfolio-chat-text">{m.text}</p>
            </div>
          ))}
          {chatLoading && (
            <div className="portfolio-chat-msg portfolio-chat-assistant">
              <span className="portfolio-chat-role">Agent</span>
              <p className="portfolio-chat-text text-muted">Thinking...</p>
            </div>
          )}
        </div>
        <div className="portfolio-chat-input-row">
          <input
            className="input"
            placeholder="Ask about your portfolio..."
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
  )
}
