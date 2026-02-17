import React, { useState } from 'react'
import './HomeChatPanel.css'

export default function HomeChatPanel({ onSend }) {
  const [draft, setDraft] = useState('')
  const [queuedPrompt, setQueuedPrompt] = useState('')
  const [status, setStatus] = useState('idle')

  const quickPrompts = [
    'Summarize this week\'s spending and flag anomalies',
    'Draft a bill pay plan for the next 7 days',
    'Create a reminder to pay rent by the 3rd of next month',
    'Convert $100 to SOL when the price dips below my target',
  ]

  const handleSend = () => {
    const prompt = draft.trim()
    if (!prompt) return
    setQueuedPrompt(prompt)
    setStatus('queued')
    setDraft('')
    if (onSend) onSend(prompt)
    console.info('[agents] prompt ready for pipeline:', prompt)
  }

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <section className="card home-chat-card">
      <div className="home-chat-headline">
        <div>
          <h2 className="section-title">Agent handoff</h2>
          <p className="home-chat-subtitle">
            Draft what you want the multi-agent pipeline to tackle. We will hold the text until the orchestrator wiring is ready.
          </p>
        </div>
        <span className="home-chat-badge">Pipeline ready soon</span>
      </div>
      <div className="home-chat-input-row">
        <textarea
          className="input home-chat-textarea"
          placeholder="Ask anything: reconcile bills, rebalance crypto, schedule payments..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="home-chat-actions">
          <button type="button" className="btn btn-primary" disabled={!draft.trim()} onClick={handleSend}>Send</button>
          <span className="home-chat-hint">Ctrl/Cmd + Enter</span>
        </div>
      </div>
      {queuedPrompt && (
        <div className="home-chat-queued">
          <div className="home-chat-status">{status === 'queued' ? 'Queued for your agents' : 'Drafted'}</div>
          <p className="home-chat-queued-text">{queuedPrompt}</p>
        </div>
      )}
      <div className="home-chat-quick-actions">
        {quickPrompts.map((text) => (
          <button key={text} type="button" className="home-chat-chip" onClick={() => setDraft(text)}>
            {text}
          </button>
        ))}
      </div>
    </section>
  )
}
