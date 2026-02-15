import React, { useState } from 'react'
import { portfolioChat } from '../api/portfolio'
import { listTransactions } from '../api/transactions'
import { listGoals } from '../api/goals'

export default function PortfolioChat({ mode, portfolio = null }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const send = async () => {
    const msg = input.trim()
    if (!msg) return
    const userMessage = { role: 'user', content: msg }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)
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

      const data = await portfolioChat({
        messages: nextMessages,
        question: msg,
        risk: mode,
        portfolio,
        spending: Object.entries(spendingByCategory).map(([category, amount_cents]) => ({ category, amount_cents })),
        savings: goals,
      })
      setMessages((prev) => [...prev, { role: 'assistant', content: data.text || 'No response.' }])
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Error: ' + err.message }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="portfolio-bottom card">
      <h2 className="section-title">Portfolio Agent</h2>
      <div className="portfolio-chat-messages">
        {messages.length === 0 && !loading && (
          <p className="text-muted portfolio-chat-empty">Ask about your spending, savings, or portfolio goals.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`portfolio-chat-msg portfolio-chat-${m.role}`}>
            <span className="portfolio-chat-role">{m.role === 'user' ? 'You' : 'Advisor'}</span>
            <p className="portfolio-chat-text">{m.content}</p>
          </div>
        ))}
        {loading && (
          <div className="portfolio-chat-msg portfolio-chat-assistant">
            <span className="portfolio-chat-role">Advisor</span>
            <p className="portfolio-chat-text text-muted">Thinking...</p>
          </div>
        )}
      </div>
      <div className="portfolio-chat-input-row">
        <input
          className="input"
          placeholder="Ask about your portfolio..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button type="button" className="btn btn-primary" onClick={send} disabled={loading || !input.trim()}>
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  )
}
