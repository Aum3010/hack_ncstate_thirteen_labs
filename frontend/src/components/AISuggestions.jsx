import React from 'react'

export default function AISuggestions({ suggestions, loading }) {
  return (
    <div className="card portfolio-suggestions-card">
      <h2 className="section-title">AI Suggestions</h2>
      {loading ? (
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
  )
}
