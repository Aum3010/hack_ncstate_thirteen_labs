import React from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

export default function PortfolioAllocationPanel({
  risk,
  riskOptions,
  onRiskChange,
  investmentAmount,
  onInvestmentAmountChange,
  investmentError,
  maxFinancialInput,
  parsedInvestmentAmount,
  formatCurrency,
  chartPieData,
  pieData,
  alloc,
  onLeverChange,
}) {
  return (
    <div className="portfolio-top-left card portfolio-panel-card">
      <h2 className="section-title">Portfolio Allocation</h2>

      <div className="portfolio-goal-row portfolio-controls-row">
        <select
          className="input portfolio-risk-select"
          value={risk}
          onChange={(e) => onRiskChange(e.target.value)}
          aria-label="Risk tolerance"
        >
          {riskOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="portfolio-financial-inputs">
        <div className="portfolio-financial-field">
          <label className="portfolio-financial-label" htmlFor="investment-amount-input">Investment Amount</label>
          <input
            id="investment-amount-input"
            type="number"
            min="0"
            max={maxFinancialInput}
            step="0.01"
            className="input"
            placeholder="0.00"
            value={investmentAmount}
            onChange={onInvestmentAmountChange}
          />
          <span className="portfolio-financial-preview">{formatCurrency(parsedInvestmentAmount)}</span>
          {investmentError ? <p className="portfolio-voice-error">{investmentError}</p> : null}
        </div>
      </div>

      <div className="portfolio-pie-wrap">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={chartPieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={96}
              paddingAngle={2}
              label={({ name, value }) => `${name} ${formatCurrency(value)}`}
            >
              {chartPieData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatCurrency(value)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="portfolio-levers">
        {pieData.map((row) => (
          <div key={row.key} className="portfolio-lever-row">
            <div className="portfolio-lever-header">
              <span className="portfolio-lever-name">{row.name}</span>
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
              <span className="portfolio-lever-pct">{row.percentage}%</span>
              <span className="portfolio-lever-amt">{formatCurrency(row.value)}</span>
            </div>
          </div>
        ))}
        <div className="portfolio-allocation-summary">
          <span>Total: {Object.values(alloc).reduce((a, b) => a + b, 0)}%</span>
          <span>Investment Amount: {formatCurrency(parsedInvestmentAmount)}</span>
        </div>
      </div>
    </div>
  )
}
