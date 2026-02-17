import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { getProfile } from '../api/users'
import { portfolioChat, getSpendingAnalysis } from '../api/portfolio'
import { listGoals } from '../api/goals'
import { listTransactions } from '../api/transactions'
import useVoiceAssistant from '../hooks/useVoiceAssistant'
import PortfolioHeaderCard from '../components/portfolio/PortfolioHeaderCard'
import PortfolioAllocationPanel from '../components/portfolio/PortfolioAllocationPanel'
import PortfolioSummaryPanel from '../components/portfolio/PortfolioSummaryPanel'
import PortfolioAssistantPanel from '../components/portfolio/PortfolioAssistantPanel'
import PortfolioSuggestionsPanel from '../components/portfolio/PortfolioSuggestionsPanel'
import './Portfolio.css'

const RISK_OPTIONS = [
  { value: 'conservative', label: 'Conservative' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'aggressive', label: 'Aggressive' },
]

const ANNUAL_RETURN_BY_RISK = {
  conservative: 0.08,
  balanced: 0.10,
  aggressive: 0.12,
}

const MAX_FINANCIAL_INPUT = 10000000

/** Map LLM category name to our 5-bucket key */
function mapCategoryToBucket(name) {
  const n = (name || '').toLowerCase()
  if (n.includes('roth') || n.includes('ira')) return 'roth'
  if (n.includes('401') || n.includes('k)')) return '_401k'
  if (n.includes('hysa') || n.includes('cash') || n.includes('savings')) return 'hysa'
  if (n.includes('gold') || n.includes('bond') || n.includes('real estate')) return 'gold'
  return 'stocks'
}

function calculateFutureValue(amount, rate, years) {
  if (!amount || amount <= 0) return 0
  return amount * ((1 + rate) ** years)
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value || 0)
}

export default function Portfolio() {
  // --- Manual allocation state (top-left) ---
  const COLORS = {
    stocks: '#10b981',
    roth: '#8b5cf6',
    _401k: '#3b82f6',
    hysa: '#f59e0b',
    gold: '#d97706',
  }
  const PRESETS = {
    conservative: { stocks: 30, roth: 20, _401k: 15, hysa: 25, gold: 10 },
    balanced: { stocks: 50, roth: 20, _401k: 15, hysa: 10, gold: 5 },
    aggressive: { stocks: 70, roth: 15, _401k: 10, hysa: 3, gold: 2 },
  }

  const [risk, setRisk] = useState('balanced')
  const [alloc, setAlloc] = useState(PRESETS.balanced)
  const [investmentAmount, setInvestmentAmount] = useState('')
  const [investmentError, setInvestmentError] = useState('')
  const [spendingSuggestions, setSpendingSuggestions] = useState([])

  // --- Chat state (bottom) ---
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const scrollContainerRef = useRef(null)
  const chatMessagesRef = useRef(null)
  const { micState, assistantAudio, voiceError, toggleRecording, speakText } = useVoiceAssistant()

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    const maxScroll = scrollHeight - clientHeight
    const progress = maxScroll <= 0 ? 0 : Math.min(1, scrollTop / maxScroll)
    setScrollProgress(progress)
  }, [])

  // --- Load profile on mount: risk_tolerance and optional income seed ---
  useEffect(() => {
    const parseIncome = (val) => {
      if (val == null) return null
      if (typeof val === 'number' && val > 0) return val
      const s = String(val).replace(/,/g, '').trim()
      const match = s.match(/[\d.]+/)
      return match ? parseFloat(match) : null
    }

    Promise.all([getProfile(), listTransactions({ limit: 200 })])
      .then(([user, txData]) => {
        if (!user) return
        const pq = user.profile_questionnaire || {}
        const oa = user.onboarding_answers || {}

        const r = (pq.risk_tolerance || oa.risk_tolerance || '').toLowerCase()
        const validRisk = r === 'conservative' || r === 'balanced' || r === 'aggressive'
        if (validRisk) {
          setRisk(r)
          setAlloc(PRESETS[r] || PRESETS.balanced)
        }

        let inc = parseIncome(pq.income)
        if (inc == null) {
          const txs = txData?.transactions || []
          const now = new Date()
          const thisMonth = txs.filter((t) => {
            const d = t.transaction_at ? new Date(t.transaction_at) : null
            return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
          })
          const derived = thisMonth
            .filter((t) => (Number(t.amount_cents) || 0) > 0)
            .reduce((sum, t) => sum + (Number(t.amount_cents) || 0) / 100, 0)
          inc = derived > 0 ? Math.round(derived) : null
        }
        if (!investmentAmount && inc != null && inc > 0) {
          setInvestmentAmount(String(Math.round(inc)))
        }
      })
      .catch(() => {})
  }, [])

  // --- Load spending analysis on mount ---
  useEffect(() => {
    getSpendingAnalysis()
      .then((data) => setSpendingSuggestions(data?.suggestions || []))
      .catch(() => setSpendingSuggestions([]))
  }, [])

  useEffect(() => {
    const el = chatMessagesRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, chatLoading])

  const applyPreset = (mode) => {
    setAlloc({ ...(PRESETS[mode] || PRESETS.balanced) })
  }

  const onLeverChange = (key, nextVal) => {
    nextVal = Math.max(0, Math.min(100, Math.round(nextVal)))
    const others = Object.keys(alloc).filter((k) => k !== key)
    const sumOthers = others.reduce((acc, k) => acc + alloc[k], 0)
    let next = { ...alloc, [key]: nextVal }
    const remaining = 100 - nextVal
    if (sumOthers <= 0) {
      // distribute evenly across others
      const even = Math.floor(remaining / others.length)
      others.forEach((k) => { next[k] = even })
      // fix rounding to hit 100
      const fix = 100 - Object.values(next).reduce((a, b) => a + b, 0)
      if (fix !== 0 && others[0]) next[others[0]] += fix
    } else {
      // scale others proportionally to fill remaining
      let accSum = 0
      others.forEach((k, idx) => {
        const scaled = Math.round((alloc[k] / sumOthers) * remaining)
        next[k] = scaled
        accSum += scaled
        // adjust the last one to fix rounding drift
        if (idx === others.length - 1) {
          const drift = 100 - (nextVal + accSum)
          next[k] = Math.max(0, next[k] + drift)
        }
      })
    }
    setAlloc(next)
  }

  const parsedInvestmentAmount = useMemo(() => {
    const n = Number(investmentAmount)
    if (!investmentAmount || !Number.isFinite(n) || n <= 0 || n > MAX_FINANCIAL_INPUT) return 0
    return n
  }, [investmentAmount])

  const pieData = useMemo(() => {
    return [
      { key: 'stocks', name: 'Stocks', percentage: alloc.stocks, value: (parsedInvestmentAmount * (alloc.stocks || 0)) / 100, fill: COLORS.stocks },
      { key: 'roth', name: 'Roth IRA', percentage: alloc.roth, value: (parsedInvestmentAmount * (alloc.roth || 0)) / 100, fill: COLORS.roth },
      { key: '_401k', name: '401K', percentage: alloc._401k, value: (parsedInvestmentAmount * (alloc._401k || 0)) / 100, fill: COLORS._401k },
      { key: 'hysa', name: 'HYSA', percentage: alloc.hysa, value: (parsedInvestmentAmount * (alloc.hysa || 0)) / 100, fill: COLORS.hysa },
      { key: 'gold', name: 'Gold Bond', percentage: alloc.gold, value: (parsedInvestmentAmount * (alloc.gold || 0)) / 100, fill: COLORS.gold },
    ]
  }, [alloc, parsedInvestmentAmount])

  const chartPieData = useMemo(() => pieData.filter((item) => item.percentage > 0), [pieData])

  const annualReturnRate = useMemo(() => ANNUAL_RETURN_BY_RISK[risk] || 0, [risk])

  const investmentSummary = useMemo(() => {
    const invested = parsedInvestmentAmount
    const grossOneYear = calculateFutureValue(invested, annualReturnRate, 1)
    const grossThreeYear = calculateFutureValue(invested, annualReturnRate, 3)
    const grossFiveYear = calculateFutureValue(invested, annualReturnRate, 5)
    return {
      invested,
      oneYear: { gross: grossOneYear, returns: grossOneYear - invested },
      threeYear: { gross: grossThreeYear, returns: grossThreeYear - invested },
      fiveYear: { gross: grossFiveYear, returns: grossFiveYear - invested },
    }
  }, [parsedInvestmentAmount, annualReturnRate])

  const portfolioState = useMemo(() => ({
    allocation: pieData.map((item) => ({ category: item.name, percentage: item.percentage, amount: item.value })),
    investmentAmount: parsedInvestmentAmount,
    profileMode: risk,
  }), [pieData, parsedInvestmentAmount, risk])

  const onFinancialInputChange = (setter, errorSetter) => (e) => {
    const raw = e.target.value
    setter(raw)
    if (!raw) {
      errorSetter('')
      return
    }
    const value = Number(raw)
    if (!Number.isFinite(value) || value <= 0) {
      errorSetter('Enter a positive amount.')
      return
    }
    if (value > MAX_FINANCIAL_INPUT) {
      errorSetter(`Amount must be ${formatCurrency(MAX_FINANCIAL_INPUT)} or less.`)
      return
    }
    errorSetter('')
  }

  // --- Chat handlers ---
  const sendChat = async (textOverride = null) => {
    const msg = (textOverride ?? chatInput).trim()
    if (!msg) return
    const userMessage = { role: 'user', content: msg }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    if (textOverride == null) setChatInput('')
    setChatLoading(true)
    try {
      const [txData, goals] = await Promise.all([
        listTransactions({ limit: 200 }),
        listGoals().catch(() => []),
      ])
      const transactions = txData?.transactions || []
      const spendingByCategory = {}
      for (const transaction of transactions) {
        const cents = Number(transaction.amount_cents || 0)
        if (cents <= 0) continue
        const category = transaction.category || 'other'
        spendingByCategory[category] = (spendingByCategory[category] || 0) + cents
      }

      const payload = {
        messages: nextMessages,
        question: msg,
        portfolio: {
          ...portfolioState,
        },
        spending: Object.entries(spendingByCategory).map(([category, amountCents]) => ({
          category,
          amount_cents: amountCents,
        })),
        savings: goals,
      }

      const data = await portfolioChat(payload)
      const assistantText = data.text || 'No response.'
      setMessages((prev) => [...prev, { role: 'assistant', content: assistantText }])
      if (assistantText) {
        speakText(assistantText).catch(() => {})
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Error: ' + err.message }])
    } finally {
      setChatLoading(false)
    }
  }

  const handleVoiceInput = async () => {
    await toggleRecording(async (transcript) => {
      setChatInput(transcript)
      await sendChat(transcript)
    }, 7000)
  }

  const handleSpeakInput = async () => {
    const text = chatInput.trim()
    if (!text) return
    await speakText(text).catch(() => {})
  }

  // --- Savings progress removed; page focused on allocation + chat ---

  return (
    <div className="portfolio-page portfolio-urban">
      <div className="portfolio-scroll-container">
        <div className="portfolio-hud">
          <PortfolioHeaderCard />

          <div className="portfolio-top">
            <PortfolioAllocationPanel
              risk={risk}
              riskOptions={RISK_OPTIONS}
              onRiskChange={(nextRisk) => {
                setRisk(nextRisk)
                applyPreset(nextRisk)
              }}
              investmentAmount={investmentAmount}
              onInvestmentAmountChange={onFinancialInputChange(setInvestmentAmount, setInvestmentError)}
              investmentError={investmentError}
              maxFinancialInput={MAX_FINANCIAL_INPUT}
              parsedInvestmentAmount={parsedInvestmentAmount}
              formatCurrency={formatCurrency}
              chartPieData={chartPieData}
              pieData={pieData}
              alloc={alloc}
              onLeverChange={onLeverChange}
            />

        {/* --- TOP RIGHT: Suggestions + Chart Q&A --- */}
        <div className="portfolio-top-right">
          <PortfolioSuggestionsPanel suggestions={spendingSuggestions} />

          <PortfolioSummaryPanel
            investmentSummary={investmentSummary}
            annualReturnRate={annualReturnRate}
            formatCurrency={formatCurrency}
          />

          <PortfolioAssistantPanel
            messages={messages}
            loading={chatLoading}
            input={chatInput}
            setInput={setChatInput}
            send={() => sendChat()}
            onVoiceInput={handleVoiceInput}
            onSpeakInput={handleSpeakInput}
            micState={micState}
            assistantAudio={assistantAudio}
            voiceError={voiceError}
            chatMessagesRef={chatMessagesRef}
          />
        </div>
      </div>
      </div>
      </div>
    </div>
  )
}
