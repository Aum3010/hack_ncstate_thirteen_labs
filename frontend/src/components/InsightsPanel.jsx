import React, { useState, useEffect } from 'react'
import { getInsights } from '../api/insights'
import './InsightsPanel.css'

export default function InsightsPanel() {
  const [insights, setInsights] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getInsights()
      .then(setInsights)
      .catch(() => setInsights([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null
  if (!insights || insights.length === 0) return null

  return (
    <div className="insights-panel card">
      <h3 className="insights-title">AI insights</h3>
      <ul className="insights-list">
        {insights.map((insight, i) => (
          <li key={i} className={`insights-item insights-${insight.category || 'general'}`}>
            {insight.text}
          </li>
        ))}
      </ul>
    </div>
  )
}
