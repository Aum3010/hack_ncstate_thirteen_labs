import React from 'react'

export default function PortfolioSuggestionsPanel({ suggestions }) {
  if (!suggestions || suggestions.length === 0) return null

  return (
    <div className="card portfolio-spending-card portfolio-panel-card">
      <h2 className="section-title">Spending suggestions</h2>
      <ul className="portfolio-savings-list">
        {suggestions.slice(0, 4).map((suggestion, index) => (
          <li key={`${suggestion.category || 'suggestion'}-${index}`} className="portfolio-savings-item">
            <span className="portfolio-suggestion-cat">{suggestion.category}</span>
            <p className="text-muted portfolio-suggestion-msg-inline">{suggestion.message}</p>
            {suggestion.save_amount > 0 && (
              <span className="portfolio-save-amt">Save ~${suggestion.save_amount.toFixed(0)}/mo</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
