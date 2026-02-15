import React, {
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from 'recharts'
import './WhatIfSimulator.css'
import { getScenarioIntelligence, getWhatIfConfig } from '../api/whatif'

const FI_TARGET_CAPITAL = 600_000
const LOAN_PRINCIPAL = 10_000
const LOAN_ANNUAL_RATE = 0.1
const LOAN_MIN_PAYMENT = 250
const BASE_MONTHLY_INVESTMENT = 300
const BASE_DISCRETIONARY_SPEND = 1_000

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

function simulateScenario({
  monthlyInvestment,
  interestRate,
  discretionaryReductionPct,
  horizonYears,
}) {
  const months = horizonYears * 12

  const annualReturn = (interestRate ?? 7) / 100
  const monthlyReturn = annualReturn / 12

  const baselineAnnualReturn = 0.07
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
  const netWorthTimeline = []

  for (let m = 1; m <= months; m += 1) {
    const baselineLoanPayment = loanBalanceBaseline > 0 ? LOAN_MIN_PAYMENT : 0
    const scenarioLoanPayment = loanBalanceScenario > 0 ? LOAN_MIN_PAYMENT : 0

    const investFlowBaseline = BASE_MONTHLY_INVESTMENT + (loanBalanceBaseline <= 0 ? LOAN_MIN_PAYMENT : 0)
    const investFlowScenario =
      monthlyInvestment +
      discSavings +
      (loanBalanceScenario <= 0 ? LOAN_MIN_PAYMENT : 0)

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

    const netWorthBaselineMonth = investBalanceBaseline - loanBalanceBaseline
    const netWorthScenarioMonth = investBalanceScenario - loanBalanceScenario

    if (monthsToFiBaseline === null && investBalanceBaseline >= FI_TARGET_CAPITAL) {
      monthsToFiBaseline = m
    }
    if (monthsToFiScenario === null && investBalanceScenario >= FI_TARGET_CAPITAL) {
      monthsToFiScenario = m
    }

    netWorthTimeline.push({
      month: m,
      netWorth: netWorthScenarioMonth,
      assets: investBalanceScenario,
      liabilities: loanBalanceScenario,
    })
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
    netWorthScenario,
    interestSaved,
    payoffShiftMonths,
    monthsToFiBaseline,
    monthsToFiScenario,
    fiShiftMonths,
    compoundingGain,
    assetsScenario: investBalanceScenario,
    liabilitiesScenario: loanBalanceScenario,
    netWorthTimeline,
  }
}

export default function WhatIfSimulator() {
  const [monthlyInvestment, setMonthlyInvestment] = useState(450)
  const [interestRate, setInterestRate] = useState(7)
  const [discretionaryReductionPct] = useState(0)
  const [horizonYears, setHorizonYears] = useState(10)

  const result = useMemo(
    () =>
      simulateScenario({
        monthlyInvestment,
        interestRate,
        discretionaryReductionPct,
        horizonYears,
      }),
    [monthlyInvestment, interestRate, discretionaryReductionPct, horizonYears],
  )

  const totalNetWorth = result.netWorthScenario || 0
  const totalAssets = result.assetsScenario || 0
  const totalLiabilities = result.liabilitiesScenario || 0
  const liquidAssets = totalAssets * 0.6
  const illiquidAssets = totalAssets - liquidAssets
  const liquidPct = totalAssets ? (liquidAssets / totalAssets) * 100 : 0
  const illiquidPct = totalAssets ? (illiquidAssets / totalAssets) * 100 : 0

  const totalMonths = horizonYears * 12
  const avgMonthlyNetWorthGrowth = totalMonths ? totalNetWorth / totalMonths : 0
  const avgYearlyNetWorthGrowth = horizonYears ? totalNetWorth / horizonYears : 0

  const netWorthChartData = result.netWorthTimeline || []

  const assetAllocationData = [
    { name: 'Liquid', value: liquidAssets },
    { name: 'Illiquid', value: illiquidAssets },
  ]

  const debtVsAssetData = [
    {
      name: 'Scenario',
      assets: totalAssets,
      liabilities: totalLiabilities,
    },
  ]

  const extraLoanPayment = 200
  const [scenarioDist, setScenarioDist] = useState([])
  const [scenarioPct, setScenarioPct] = useState(null)
  const [scenarioLiquidity, setScenarioLiquidity] = useState(null)
  const [scenarioSurvivalProb, setScenarioSurvivalProb] = useState(null)
  const [scenarioRecoveryYears, setScenarioRecoveryYears] = useState(null)
  const [scenarioComparisons, setScenarioComparisons] = useState(null)
  const [scenarioCoach, setScenarioCoach] = useState(null)
  const [scenarioLoading, setScenarioLoading] = useState(false)
  const [scenarioError, setScenarioError] = useState('')
  const [llmConfig, setLlmConfig] = useState(null)
  const [regime, setRegime] = useState('balanced')

  useEffect(() => {
    let cancelled = false
    async function loadConfig() {
      try {
        const cfg = await getWhatIfConfig()
        if (!cancelled) setLlmConfig(cfg)
      } catch {
        if (!cancelled) setLlmConfig(null)
      }
    }
    loadConfig()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const timeout = setTimeout(async () => {
      setScenarioLoading(true)
      setScenarioError('')
      try {
        const data = await getScenarioIntelligence({
          monthlyInvestment,
          extraLoanPayment,
          horizonYears,
          regime,
        })
        if (cancelled) return
        setScenarioDist(data.distribution || [])
        setScenarioPct(data.percentiles || null)
        setScenarioLiquidity(data.liquidity || null)
        setScenarioSurvivalProb(
          typeof data.survival_prob === 'number' ? data.survival_prob : null,
        )
        setScenarioRecoveryYears(
          typeof data.recovery_years === 'number' ? data.recovery_years : null,
        )
        setScenarioComparisons(data.comparisons || null)
        setScenarioCoach(data.coach || null)
      } catch (err) {
        if (!cancelled) {
          setScenarioError('Unable to load scenario intelligence right now.')
        }
      } finally {
        if (!cancelled) setScenarioLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [monthlyInvestment, extraLoanPayment, horizonYears, regime])

  const medianOutcome = scenarioPct?.p50 ?? null
  const worstOutcome = scenarioPct?.p10 ?? null
  const bestOutcome = scenarioPct?.p90 ?? null
  const survivalProbPctRaw = scenarioSurvivalProb != null
    ? Math.round(scenarioSurvivalProb * 100)
    : null
  const recoveryYearsRaw = scenarioRecoveryYears

  // Fallbacks so cards are never blank
  const survivalProbPct = survivalProbPctRaw != null
    ? survivalProbPctRaw
    : (() => {
        if (scenarioLiquidity?.avg_months >= 6) return 90
        if (scenarioLiquidity?.avg_months != null) return 40
        return 60
      })()

  const recoveryYears = recoveryYearsRaw != null
    ? recoveryYearsRaw
    : (() => {
        if (horizonYears >= 5 && horizonYears <= 30) return horizonYears / 2
        if (horizonYears > 0) return horizonYears
        return 3
      })()

  const totalContributions = monthlyInvestment * horizonYears * 12
  const wealthGrowthMultiple = totalContributions > 0 && medianOutcome != null
    ? medianOutcome / totalContributions
    : null

  const baselineDelta = scenarioComparisons?.baseline
  const bullDelta = scenarioComparisons?.bull


  return (
    <div className="sim-page">
      <div className="card sim-hero">
        <div className="sim-hero-main">
          <div>
            <h1 className="page-title">Scenario Intelligence</h1>
            <p className="text-muted sim-subtitle">
              Here&apos;s how many possible futures play out as you move the sliders.
            </p>
          </div>
          <div className="sim-hero-right">
            <div className="sim-hero-growth-value">
              {formatCurrency(totalNetWorth)}
            </div>
            <div className="sim-hero-growth-label">
              Median projected net worth (
              {horizonYears}
              {' '}
              yrs)
            </div>
            {llmConfig && (
              <div className="sim-hero-model text-muted">
                AI model:
                {' '}
                {llmConfig.provider === 'groq'
                  ? `Groq · ${llmConfig.groq_model}`
                  : llmConfig.provider}
                {!llmConfig.groq_ready && llmConfig.provider === 'groq' && ' (key missing)'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="sim-main-grid">
        <section className="sim-panel-inputs">
          <h2 className="section-title">Inputs</h2>

          <div className="sim-control">
            <div className="sim-control-header">
              <span className="sim-control-label">Monthly investment</span>
              <span className="sim-control-value">{formatCurrency(monthlyInvestment)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="500000"
              step="100"
              value={monthlyInvestment}
              onChange={(e) => setMonthlyInvestment(Number(e.target.value))}
            />
            <div style={{ marginTop: '0.35rem' }}>
              <input
                type="number"
                min="0"
                max="500000"
                step="100"
                value={monthlyInvestment}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (Number.isNaN(v)) return
                  const clamped = Math.min(500000, Math.max(0, v))
                  setMonthlyInvestment(clamped)
                }}
                style={{
                  width: '110px',
                  padding: '0.25rem 0.4rem',
                  background: 'var(--bg-elevated)',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                }}
              />
            </div>
            <p className="sim-help text-muted">
              How much you invest into assets each month.
            </p>
          </div>

          <div className="sim-control">
            <div className="sim-control-header">
              <span className="sim-control-label">Interest gained (annual)</span>
              <span className="sim-control-value">
                {interestRate.toFixed(1)}
                %
              </span>
            </div>
            <p className="sim-help text-muted">
              Expected annual return you want to test for this scenario. Baseline model assumes around 7%.
            </p>
            <div style={{ marginTop: '0.35rem' }}>
              <input
                type="number"
                min="0"
                max="50"
                step="0.5"
                value={interestRate}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (Number.isNaN(v)) return
                  const clamped = Math.min(50, Math.max(0, v))
                  setInterestRate(clamped)
                }}
                style={{
                  width: '90px',
                  padding: '0.25rem 0.4rem',
                  background: 'var(--bg-elevated)',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                }}
              />
            </div>
          </div>

          <div className="sim-control">
            <div className="sim-control-header">
              <span className="sim-control-label">Target timeline</span>
              <span className="sim-control-value">
                {horizonYears}
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

          <div className="sim-control">
            <div className="sim-control-header">
              <span className="sim-control-label">Market regime</span>
            </div>
            <div className="sim-riskchips">
              {[
                { key: 'bull', label: '🐂 Bull cycle' },
                { key: 'bear', label: '🐻 Bear cycle' },
                { key: 'high_vol', label: '🌪 High volatility year' },
                { key: 'crypto_winter', label: '🧊 Crypto winter' },
              ].map((r) => (
                <button
                  key={r.key}
                  type="button"
                  className={`sim-chip ${regime === r.key ? 'active' : ''}`}
                  onClick={() => setRegime(r.key)}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <p className="sim-help text-muted">
              Simulate bull, bear, high-volatility, or crypto winter regimes. Survival and recovery metrics will update.
            </p>
          </div>
        </section>

        <section className="card sim-panel-metrics">
          <h2 className="section-title">Outcome Metrics</h2>

          <div className="sim-summary card-inner" style={{ marginBottom: '0.75rem' }}>
            <h3>AI Financial Coach</h3>
            <p className="sim-assumptions">
              {scenarioLoading && 'Crunching possible futures...'}
              {!scenarioLoading && scenarioError && scenarioError}
              {!scenarioLoading && !scenarioError
                && (scenarioCoach?.commentary || 'Move the sliders to see live, context-aware commentary.')}
            </p>
          </div>

          <div className="sim-kpis">
            <div className="sim-kpi">
              <div className="sim-kpi-label">Expected Net Worth (risk-adjusted)</div>
              <div className="sim-kpi-value neon-green">
                {medianOutcome != null ? formatCurrency(medianOutcome) : '—'}
              </div>
              <div className="sim-kpi-sub text-muted">
                Adjusted for volatility and drawdown risk.
                {baselineDelta && (
                  <>
                    {' · '}
                    <span className={baselineDelta.delta_net_worth_p50 >= 0 ? 'text-positive' : 'text-negative'}>
                      {baselineDelta.delta_net_worth_p50 >= 0 ? '🟢 +' : '🔴 '}
                      {formatCurrency(Math.abs(baselineDelta.delta_net_worth_p50))}
                    </span>
                    {' '}
                    vs baseline
                    {bullDelta && (
                      <>
                        {' · '}
                        <span className={bullDelta.delta_net_worth_p50 >= 0 ? 'text-positive' : 'text-negative'}>
                          {bullDelta.delta_net_worth_p50 >= 0 ? '🟢 +' : '🔴 '}
                          {formatCurrency(Math.abs(bullDelta.delta_net_worth_p50))}
                        </span>
                        {' '}
                        vs bull
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="sim-kpi">
              <div className="sim-kpi-label">Worst 10% Outcome (P10)</div>
              <div className="sim-kpi-value">
                {worstOutcome != null ? formatCurrency(worstOutcome) : '—'}
              </div>
            </div>

            <div className="sim-kpi">
              <div className="sim-kpi-label">Wealth Growth per $1 Invested</div>
              <div className="sim-kpi-value">
                {wealthGrowthMultiple != null ? `${wealthGrowthMultiple.toFixed(2)}x` : '—'}
              </div>
              <div className="sim-kpi-sub text-muted">
                Every $1 you invest monthly over this horizon is projected to compound to this multiple of its original value.
              </div>
            </div>

            <div className="sim-kpi">
              <div className="sim-kpi-label">Survival Probability</div>
              <div className="sim-kpi-value">
                {`${survivalProbPct}%`}
              </div>
              <div className="sim-kpi-sub text-muted">
                Chance of keeping at least 6 months of liquidity without forced selling. Estimated when regime data is sparse.
                {baselineDelta && (
                  <>
                    {' · '}
                    <span className={baselineDelta.delta_liquidity_months >= 0 ? 'text-positive' : 'text-negative'}>
                      {baselineDelta.delta_liquidity_months >= 0 ? '🟢 +' : '🔴 '}
                      {baselineDelta.delta_liquidity_months.toFixed(1)}
                      {' '}
                      mo vs baseline
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="sim-kpi">
              <div className="sim-kpi-label">Liquidity Runway</div>
              <div className="sim-kpi-value">
                {scenarioLiquidity?.avg_months != null
                  ? `${scenarioLiquidity.avg_months.toFixed(1)} mo`
                  : '—'}
              </div>
              <div className="sim-kpi-sub text-muted">
                You can survive approximately this many months without new income before your liquidity buffer runs dry.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
