import React, { useState } from 'react'
import { portfolioChat } from '../api/portfolio'
import { listTransactions } from '../api/transactions'
import { listGoals } from '../api/goals'
import useVoiceAssistant from '../hooks/useVoiceAssistant'

export default function PortfolioChat({ mode, portfolio = null }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const { micState, assistantAudio, voiceError, toggleRecording, speakText } = useVoiceAssistant()

  const send = async (textOverride = null) => {
    const msg = (textOverride ?? input).trim()
    if (!msg) return
    const userMessage = { role: 'user', content: msg }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    if (textOverride == null) setInput('')
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
      const assistantText = data.text || 'No response.'
      setMessages((prev) => [...prev, { role: 'assistant', content: assistantText }])
      if (assistantText) {
        speakText(assistantText).catch(() => {})
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Error: ' + err.message }])
    } finally {
      setLoading(false)
    }
  }

  const handleVoiceInput = async () => {
    await toggleRecording(async (transcript) => {
      setInput(transcript)
      await send(transcript)
    }, 7000)
  }

  const handleSpeakInput = async () => {
    const text = input.trim()
    if (!text) return
    await speakText(text).catch(() => {})
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
        <button
          type="button"
          className={`btn btn-primary portfolio-chat-mic ${micState === 'recording' ? 'portfolio-chat-mic-recording' : ''}`}
          onClick={handleVoiceInput}
          disabled={loading || micState === 'processing'}
          aria-label="Voice input"
          title={micState === 'recording' ? 'Stop recording' : micState === 'processing' ? 'Processing voice' : 'Voice input'}
        >
          {micState === 'recording' ? '■' : micState === 'processing' ? '...' : '🎤'}
        </button>
        <button
          type="button"
          className="btn btn-primary portfolio-chat-speak"
          onClick={handleSpeakInput}
          disabled={loading || micState === 'processing' || assistantAudio === 'playing' || !input.trim()}
          aria-label="Speak text"
          title={assistantAudio === 'playing' ? 'Playing audio' : 'Speak typed text'}
        >
          {assistantAudio === 'playing' ? '...' : '🔊'}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => send()} disabled={loading || micState === 'processing' || !input.trim()}>
          {loading ? '...' : 'Send'}
        </button>
      </div>
      {voiceError ? <p className="portfolio-voice-error">{voiceError}</p> : null}
    </div>
  )
}
