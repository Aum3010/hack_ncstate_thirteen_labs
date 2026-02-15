import React from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

const RISK_OPTIONS = [
  { value: 'conservative', label: 'Conservative' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'aggressive', label: 'Aggressive' },
]

export default function AllocationPie({ goalInput, setGoalInput, risk, setRisk, pieData, loading, error, onSubmit }) {
  return (
    <div className="portfolio-top-left card">
      <h2 className="section-title">Portfolio Allocation</h2>
      <form className="portfolio-goal-form" onSubmit={onSubmit}>
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
            onChange={(e) => {
              const nextRisk = e.target.value
              setRisk(nextRisk)
              if (goalInput.trim() && !loading) {
                onSubmit(null, { goal: goalInput.trim(), risk: nextRisk })
              }
            }}
            aria-label="Risk tolerance"
          >
            {RISK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary" disabled={loading || !goalInput.trim()}>
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </form>
      {error && <div className="portfolio-error">{error}</div>}
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
  )
}
