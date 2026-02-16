import React from 'react'

export default function SavingsProgress({ savings, loading }) {
  return (
    <div className="card portfolio-savings-card">
      <h2 className="section-title">Savings Progress</h2>
      {loading ? (
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
  )
}
