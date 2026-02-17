import React from 'react'

export default function PortfolioSummaryPanel({
  investmentSummary,
  annualReturnRate,
  formatCurrency,
}) {
  return (
    <div className="portfolio-summary-card card portfolio-panel-card">
      <h2 className="section-title">Investment Summary</h2>
      <div className="portfolio-summary-grid">
        <div className="portfolio-summary-item">
          <span>Invested Amount</span>
          <strong>{formatCurrency(investmentSummary.invested)}</strong>
          <small>{Math.round(annualReturnRate * 100)}% annual</small>
        </div>
        <div className="portfolio-summary-item">
          <span>1 Year Return</span>
          <strong>{formatCurrency(investmentSummary.oneYear.returns)}</strong>
          <small>Gross: {formatCurrency(investmentSummary.oneYear.gross)}</small>
        </div>
        <div className="portfolio-summary-item">
          <span>3 Years Return</span>
          <strong>{formatCurrency(investmentSummary.threeYear.returns)}</strong>
          <small>Gross: {formatCurrency(investmentSummary.threeYear.gross)}</small>
        </div>
        <div className="portfolio-summary-item">
          <span>5 Years Return</span>
          <strong>{formatCurrency(investmentSummary.fiveYear.returns)}</strong>
          <small>Gross: {formatCurrency(investmentSummary.fiveYear.gross)}</small>
        </div>
      </div>
    </div>
  )
}
