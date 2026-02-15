import React, { useMemo, useState } from 'react'
import './WhatIfSimulator.css'

const FI_TARGET_CAPITAL = 600_000
const LOAN_PRINCIPAL = 10_000
const LOAN_ANNUAL_RATE = 0.1
const LOAN_MIN_PAYMENT = 250
const BASE_MONTHLY_INVESTMENT = 300
const BASE_DISCRETIONARY_SPEND = 1_000

const RISK_PROFILES = [
  { id: 0, key: 'conservative', label: 'Conservative', annualReturn: 0.04 },
  { id: 1, key: 'balanced', label: 'Balanced', annualReturn: 0.07 },
  { id: 2, key: 'aggressive', label: 'Aggressive', annualReturn: 0.1 },
]

function formatCurrency(amount) {
  const sign = amount < 0 ? '-' : ''
  const v = Math.abs(amount)
  return `${sign}$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function formatMonthsToYears(months) {
  if (!months && months !== 0) return 'N/A'
  const years = months / 12
  return `${years.toFixed(1)} yrs`
}

function getRiskScore(inputs, result) {
  const {
    monthlyInvestment,
    extraLoanPayment,
    discretionaryReductionPct,
    stakedPct,
    riskProfileId,
  } = inputs
  const { interestSaved, payoffShiftMonths } = result

  let score = 0

  if (riskProfileId === 0) score += 10
  if (riskProfileId === 1) score += 35
  if (riskProfileId === 2) score += 60

  if (stakedPct > 40) {
    score += (stakedPct - 40) * 0.6
  } else if (stakedPct < 20) {
    score -= 5
  }

  if (discretionaryReductionPct >= 15) {
    score -= 10
  } else if (discretionaryReductionPct <= 5) {
    score += 10
  }

  if (monthlyInvestment < BASE_MONTHLY_INVESTMENT && riskProfileId >= 1) {
    score += 10
  } else if (monthlyInvestment >= BASE_MONTHLY_INVESTMENT + 200) {
    score -= 5
  }

  if (extraLoanPayment >= 200) {
    score -= 10
  } else if (extraLoanPayment === 0 && payoffShiftMonths <= 0 && interestSaved <= 100) {
    score += 5
  }

  const clamped = Math.max(0, Math.min(100, Math.round(score)))

  let band = 'low'
  if (clamped >= 25 && clamped < 50) band = 'medium'
  else if (clamped >= 50 && clamped < 75) band = 'high'
  else if (clamped >= 75) band = 'unsustainable'

  return { score: clamped, band }
}

function getAgentVerdict(inputs, result) {
  const {
    monthlyInvestment,
    extraLoanPayment,
    discretionaryReductionPct,
    stakedPct,
    riskProfileId,
  } = inputs

  const { netWorthDelta, interestSaved, compoundingGain, payoffShiftMonths } = result

  const isDebtFocused = extraLoanPayment > 0 && interestSaved > 0
  const isAggressiveInvestor =
    monthlyInvestment > BASE_MONTHLY_INVESTMENT + 150 ||
    discretionaryReductionPct >= 15 ||
    riskProfileId === 2
  const isHeavierStaking = stakedPct >= 60

  if (isDebtFocused && interestSaved > 1500 && netWorthDelta >= 0) {
    return {
      level: 'strong',
      title: 'Strong Optimization',
      description:
        'Extra payments are rapidly reducing high-interest debt while keeping your long-term net worth on track. This is a financially efficient allocation of cash flow.',
    }
  }

  if (isDebtFocused && netWorthDelta < 0) {
    return {
      level: 'moderate',
      title: 'Moderate Strategy',
      description:
        'You are accelerating loan payoff but sacrificing some investment compounding. This can be good for risk reduction, but long-term wealth growth may slow slightly.',
    }
  }

  if (isAggressiveInvestor && netWorthDelta > 0 && compoundingGain > 0) {
    return {
      level: 'growth',
      title: 'Growth-Oriented Plan',
      description:
        'Higher contributions and risk are increasing your projected net worth. Ensure you are comfortable with the added volatility and that emergency cash needs are covered.',
    }
  }

  if (payoffShiftMonths > 0 && interestSaved > 0) {
    return {
      level: 'balanced',
      title: 'Balanced Improvement',
      description:
        'Your adjustments modestly improve both debt payoff speed and total interest paid, without radically changing risk. It is a sensible incremental upgrade.',
    }
  }

  if (netWorthDelta > 0) {
    return {
      level: 'lean-positive',
      title: 'Slightly Optimized',
      description:
        'Your scenario improves projected net worth versus the baseline. The gains are modest but directionally positive.',
    }
  }

  if (netWorthDelta < 0) {
    return {
      level: 'caution',
      title: 'Caution: Potential Trade-Off',
      description:
        'Your current settings reduce projected long-term net worth compared to the baseline. Consider rebalancing between debt payoff, risk, and contributions.',
    }
  }

  return {
    level: 'neutral',
    title: 'Neutral Impact',
    description:
      'These settings behave very close to your baseline plan. Adjust contributions, risk, or loan payments more aggressively to see a clearer effect.',
  }
}

function simulateScenario({
  monthlyInvestment,
  extraLoanPayment,
  discretionaryReductionPct,
  stakedPct,
  riskProfileId,
  horizonYears,
}) {
  const months = horizonYears * 12

  const risk = RISK_PROFILES.find((r) => r.id === riskProfileId) || RISK_PROFILES[1]
  const stakingBoost = (stakedPct / 100) * 0.01
  const annualReturn = risk.annualReturn + stakingBoost
  const monthlyReturn = annualReturn / 12

  const baselineAnnualReturn = RISK_PROFILES[1].annualReturn
  const baselineMonthlyReturn = baselineAnnualReturn / 12

  let investBalanceBaseline = 0
  let investBalanceScenario = 0
  let loanBalanceBaseline = LOAN_PRINCIPAL
  let loanBalanceScenario = LOAN_PRINCIPAL
  let totalInterestBaseline = 0
  let totalInterestScenario = 0
  let monthsToFiBaseline = null
  let monthsToFiScenario = null
  let contributionsBaseline = 0
  let contributionsScenario = 0

  const discSavings = BASE_DISCRETIONARY_SPEND * (discretionaryReductionPct / 100)

  let loanPaidMonthBaseline = null
  let loanPaidMonthScenario = null

  for (let m = 1; m <= months; m += 1) {
    const baselineLoanPayment = loanBalanceBaseline > 0 ? LOAN_MIN_PAYMENT : 0
    const scenarioLoanPayment = loanBalanceScenario > 0 ? LOAN_MIN_PAYMENT + extraLoanPayment : 0

    const investFlowBaseline = BASE_MONTHLY_INVESTMENT + (loanBalanceBaseline <= 0 ? LOAN_MIN_PAYMENT : 0)
    const investFlowScenario =
      monthlyInvestment +
      discSavings +
      (loanBalanceScenario <= 0 ? LOAN_MIN_PAYMENT + extraLoanPayment : 0)

    contributionsBaseline += investFlowBaseline
    contributionsScenario += investFlowScenario

    investBalanceBaseline = investBalanceBaseline * (1 + baselineMonthlyReturn) + investFlowBaseline
    investBalanceScenario = investBalanceScenario * (1 + monthlyReturn) + investFlowScenario

    if (loanBalanceBaseline > 0) {
      const interest = loanBalanceBaseline * (LOAN_ANNUAL_RATE / 12)
      const principalPayment = Math.max(baselineLoanPayment - interest, 0)
      loanBalanceBaseline = Math.max(loanBalanceBaseline - principalPayment, 0)
      totalInterestBaseline += interest
      if (loanBalanceBaseline <= 0 && loanPaidMonthBaseline === null) {
        loanPaidMonthBaseline = m
      }
    }

    if (loanBalanceScenario > 0) {
      const interest = loanBalanceScenario * (LOAN_ANNUAL_RATE / 12)
      const principalPayment = Math.max(scenarioLoanPayment - interest, 0)
      loanBalanceScenario = Math.max(loanBalanceScenario - principalPayment, 0)
      totalInterestScenario += interest
      if (loanBalanceScenario <= 0 && loanPaidMonthScenario === null) {
        loanPaidMonthScenario = m
      }
    }

    if (monthsToFiBaseline === null && investBalanceBaseline >= FI_TARGET_CAPITAL) {
      monthsToFiBaseline = m
    }
    if (monthsToFiScenario === null && investBalanceScenario >= FI_TARGET_CAPITAL) {
      monthsToFiScenario = m
    }
  }

  const netWorthBaseline = investBalanceBaseline - loanBalanceBaseline
  const netWorthScenario = investBalanceScenario - loanBalanceScenario
  const netWorthDelta = netWorthScenario - netWorthBaseline
  const interestSaved = totalInterestBaseline - totalInterestScenario

  const contributionDiff = contributionsScenario - contributionsBaseline
  const compoundingGain = Math.max(netWorthDelta - contributionDiff, 0)

  const payoffShiftMonths =
    loanPaidMonthBaseline && loanPaidMonthScenario
      ? loanPaidMonthBaseline - loanPaidMonthScenario
      : 0

  const fiShiftMonths =
    monthsToFiBaseline && monthsToFiScenario
      ? monthsToFiBaseline - monthsToFiScenario
      : null

  return {
    netWorthDelta,
    netWorthBaseline,
    netWorthScenario,
    interestSaved,
    payoffShiftMonths,
    monthsToFiBaseline,
    monthsToFiScenario,
    fiShiftMonths,
    compoundingGain,
  }
}

export default function WhatIfSimulator() {
  const [monthlyInvestment, setMonthlyInvestment] = useState(450)
  const [extraLoanPayment, setExtraLoanPayment] = useState(200)
  const [discretionaryReductionPct] = useState(0)
  const [stakedPct] = useState(50)
  const [riskProfileId, setRiskProfileId] = useState(1)
  const [primaryGoal, setPrimaryGoal] = useState('fi')
  const [riskComfort, setRiskComfort] = useState('balanced')
  const [horizonYears, setHorizonYears] = useState(10)

  const result = useMemo(
    () =>
      simulateScenario({
        monthlyInvestment,
        extraLoanPayment,
        discretionaryReductionPct,
        stakedPct,
        riskProfileId,
        horizonYears,
      }),
    [monthlyInvestment, extraLoanPayment, discretionaryReductionPct, stakedPct, riskProfileId, horizonYears],
  )

  const riskProfile = RISK_PROFILES.find((r) => r.id === riskProfileId) || RISK_PROFILES[1]
  const risk = useMemo(
    () =>
      getRiskScore(
        { monthlyInvestment, extraLoanPayment, discretionaryReductionPct, stakedPct, riskProfileId },
        result,
      ),
    [monthlyInvestment, extraLoanPayment, discretionaryReductionPct, stakedPct, riskProfileId, result],
  )
  const verdict = useMemo(
    () =>
      getAgentVerdict(
        { monthlyInvestment, extraLoanPayment, discretionaryReductionPct, stakedPct, riskProfileId },
        result,
      ),
    [monthlyInvestment, extraLoanPayment, discretionaryReductionPct, stakedPct, riskProfileId, result],
  )
  const targetLabelYears = horizonYears

  React.useEffect(() => {
    if (riskComfort === 'safety') {
      setRiskProfileId(0)
    } else if (riskComfort === 'balanced') {
      setRiskProfileId(1)
    } else {
      setRiskProfileId(2)
    }
  }, [riskComfort])

  React.useEffect(() => {
    if (primaryGoal === 'fi') {
      setMonthlyInvestment(450)
      setExtraLoanPayment(200)
    } else if (primaryGoal === 'debt_fast') {
      setMonthlyInvestment(250)
      setExtraLoanPayment(400)
    } else if (primaryGoal === 'growth') {
      setMonthlyInvestment(600)
      setExtraLoanPayment(150)
    } else if (primaryGoal === 'preserve') {
      setMonthlyInvestment(350)
      setExtraLoanPayment(250)
    }
  }, [primaryGoal])


  return (
    <div className="sim-page">
      <div className="card sim-hero">
        <div className="sim-hero-main">
          <div>
            <h1 className="page-title">Vault Simulation Console</h1>
            <p className="text-muted sim-subtitle">
              Live what-if engine for your Solana-powered finances.
            </p>
          </div>
          <div className="sim-hero-right">
            <div className="sim-hero-growth-value">
              {formatCurrency(result.netWorthDelta)}
            </div>
            <div className="sim-hero-growth-label">
              Projected growth ({targetLabelYears}
              {' '}
              yrs)
            </div>
            <div className="sim-hero-status">
              <div
                className={
                  'sim-status-badge ' +
                  (risk.band === 'low'
                    ? 'sim-status-stable'
                    : risk.band === 'unsustainable'
                      ? 'sim-status-unstable'
                      : 'sim-status-elevated')
                }
              >
                {risk.band === 'low' && '🟢 System stable'}
                {(risk.band === 'medium' || risk.band === 'high') && '🟡 Elevated risk'}
                {risk.band === 'unsustainable' && '🔴 Instability detected'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sim-main-grid">
        <section className="sim-panel-inputs">
          <h2 className="section-title">Inputs</h2>

          <div className="sim-control">
            <div className="sim-control-header">
              <span className="sim-control-label">How much can you realistically invest per month?</span>
              <span className="sim-control-value">{formatCurrency(monthlyInvestment)}</span>
            </div>
            <input
              type="range"
              min="100"
              max="2000"
              step="50"
              value={monthlyInvestment}
              onChange={(e) => setMonthlyInvestment(Number(e.target.value))}
            />
            <p className="sim-help text-muted">
              This is how much you&apos;re comfortable routing into investments each month.
            </p>
          </div>

          <div className="sim-control">
            <div className="sim-control-header">
              <span className="sim-control-label">Extra loan payment</span>
              <span className="sim-control-value">{formatCurrency(extraLoanPayment)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1000"
              step="25"
              value={extraLoanPayment}
              onChange={(e) => setExtraLoanPayment(Number(e.target.value))}
            />
            <p className="sim-help text-muted">
              Extra amount on top of a {formatCurrency(LOAN_MIN_PAYMENT)} baseline payment toward a sample{' '}
              {formatCurrency(LOAN_PRINCIPAL)} loan at {(LOAN_ANNUAL_RATE * 100).toFixed(1)}% APR.
            </p>
          </div>

          <div className="sim-control">
            <div className="sim-control-header">
              <span className="sim-control-label">Primary financial goal</span>
              <span className="sim-control-value">
                {primaryGoal === 'fi' && 'Financial independence'}
                {primaryGoal === 'debt_fast' && 'Pay off debt fast'}
                {primaryGoal === 'growth' && 'Wealth growth'}
                {primaryGoal === 'preserve' && 'Capital preservation'}
              </span>
            </div>
            <div className="sim-toggle-group">
              <button
                type="button"
                className={`sim-toggle ${primaryGoal === 'fi' ? 'active' : ''}`}
                onClick={() => setPrimaryGoal('fi')}
              >
                Financial independence
              </button>
              <button
                type="button"
                className={`sim-toggle ${primaryGoal === 'debt_fast' ? 'active' : ''}`}
                onClick={() => setPrimaryGoal('debt_fast')}
              >
                Pay off debt fast
              </button>
              <button
                type="button"
                className={`sim-toggle ${primaryGoal === 'growth' ? 'active' : ''}`}
                onClick={() => setPrimaryGoal('growth')}
              >
                Wealth growth
              </button>
              <button
                type="button"
                className={`sim-toggle ${primaryGoal === 'preserve' ? 'active' : ''}`}
                onClick={() => setPrimaryGoal('preserve')}
              >
                Capital preservation
              </button>
            </div>
            <p className="sim-help text-muted">
              Tell the simulator what you care about most so it can interpret trade-offs correctly.
            </p>
          </div>

          <div className="sim-control">
            <div className="sim-control-header">
              <span className="sim-control-label">Risk comfort level</span>
              <span className="sim-control-value">
                {riskComfort === 'safety' && 'Safety'}
                {riskComfort === 'balanced' && 'Balanced'}
                {riskComfort === 'growth' && 'Growth'}
              </span>
            </div>
            <div className="sim-riskchips">
              <button
                type="button"
                className={`sim-chip ${riskComfort === 'safety' ? 'active' : ''}`}
                onClick={() => setRiskComfort('safety')}
              >
                Safety
              </button>
              <button
                type="button"
                className={`sim-chip ${riskComfort === 'balanced' ? 'active' : ''}`}
                onClick={() => setRiskComfort('balanced')}
              >
                Balanced
              </button>
              <button
                type="button"
                className={`sim-chip ${riskComfort === 'growth' ? 'active' : ''}`}
                onClick={() => setRiskComfort('growth')}
              >
                Growth
              </button>
            </div>
            <p className="sim-help text-muted">
              This trades off safety, growth potential, and emotional stress in market swings.
            </p>
          </div>

          <div className="sim-control">
            <div className="sim-control-header">
              <span className="sim-control-label">Target timeline</span>
              <span className="sim-control-value">
                {targetLabelYears}
                {' '}
                yrs
              </span>
            </div>
            <div className="sim-riskchips">
              {[5, 10, 20].map((y) => (
                <button
                  key={y}
                  type="button"
                  className={`sim-chip ${horizonYears === y ? 'active' : ''}`}
                  onClick={() => setHorizonYears(y)}
                >
                  {y}
                  {' '}
                  yrs
                </button>
              ))}
            </div>
            <p className="sim-help text-muted">
              Choose how far into the future you want this scenario to project.
            </p>
          </div>
        </section>

        <section className="card sim-panel-metrics">
          <h2 className="section-title">Key metrics</h2>

          <div className="sim-kpis">
            <div className="sim-kpi">
              <div className="sim-kpi-label">Net worth delta</div>
              <div className="sim-kpi-value neon-green">{formatCurrency(result.netWorthDelta)}</div>
              <div className="sim-kpi-sub text-muted">
                Difference between baseline and your current slider settings after 10 years.
              </div>
            </div>

            <div className="sim-kpi">
              <div className="sim-kpi-label">Loan payoff shift</div>
              <div className="sim-kpi-value neon-pink">
                {result.payoffShiftMonths > 0
                  ? `${result.payoffShiftMonths} months earlier`
                  : result.payoffShiftMonths < 0
                    ? `${Math.abs(result.payoffShiftMonths)} months later`
                    : 'No change'}
              </div>
              <div className="sim-kpi-sub text-muted">
                Based on the sample loan model vs minimum payment only.
              </div>
            </div>

            <div className="sim-kpi">
              <div className="sim-kpi-label">Total interest saved</div>
              <div className="sim-kpi-value neon-green">{formatCurrency(result.interestSaved)}</div>
              <div className="sim-kpi-sub text-muted">
                Cumulative interest avoided by paying extra on the loan.
              </div>
            </div>

            <div className="sim-kpi">
              <div className="sim-kpi-label">Compounding gain difference</div>
              <div className="sim-kpi-value">
                {formatCurrency(result.compoundingGain)}
              </div>
              <div className="sim-kpi-sub text-muted">
                Portion of the net worth delta coming from compounding, not just extra contributions.
              </div>
            </div>
          </div>

          <div className="sim-summary card-inner">
            <h3>Projection & timeline</h3>
            <div className="sim-timeline-strip">
              <span className="sim-timeline-label">Baseline:</span>
              <span className="sim-timeline-value">
                {result.monthsToFiBaseline ? formatMonthsToYears(result.monthsToFiBaseline) : 'Not reached'}
              </span>
              <span className="sim-timeline-sep">•</span>
              <span className="sim-timeline-label">Scenario:</span>
              <span className="sim-timeline-value">
                {result.monthsToFiScenario ? formatMonthsToYears(result.monthsToFiScenario) : 'Not reached'}
              </span>
              <span className="sim-timeline-sep">•</span>
              <span className="sim-timeline-label">Net worth:</span>
              <span className="sim-timeline-value">
                {formatCurrency(result.netWorthBaseline)} → {formatCurrency(result.netWorthScenario)}
              </span>
            </div>
            <div className="sim-timeline-progress">
              <div className="sim-timeline-line" />
            </div>
            <p className="text-muted sim-assumptions">
              Assumptions: sample loan of {formatCurrency(LOAN_PRINCIPAL)} at {(LOAN_ANNUAL_RATE * 100).toFixed(1)}% APR,
              10-year horizon, and a financial independence target of {formatCurrency(FI_TARGET_CAPITAL)}. All numbers are
              illustrative and not financial advice.
            </p>
          </div>
        </section>
      </div>

      <section className="card sim-verdict-panel">
        <div className="sim-verdict-heading">AGENT ASSESSMENT</div>
        <div className={`sim-verdict-main sim-verdict-main-${verdict.level}`}>
          {verdict.title}
        </div>
        <p className="sim-verdict-text">
          {verdict.description}
        </p>
        <div className="sim-risk-meter">
          <div className="sim-risk-meter-bar">
            <div
              className="sim-risk-meter-indicator"
              style={{ left: `${risk.score}%` }}
            />
          </div>
          <div className="sim-risk-meter-labels">
            <span className={'sim-risk-label' + (risk.band === 'low' ? ' active' : '')}>Low risk</span>
            <span className={'sim-risk-label' + (risk.band === 'medium' ? ' active' : '')}>Medium</span>
            <span className={'sim-risk-label' + (risk.band === 'high' ? ' active' : '')}>High</span>
            <span className={'sim-risk-label' + (risk.band === 'unsustainable' ? ' active' : '')}>Unsustainable</span>
          </div>
        </div>
      </section>
    </div>
  )
}
