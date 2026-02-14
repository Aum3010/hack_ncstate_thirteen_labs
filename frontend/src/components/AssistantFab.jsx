import React, { useState } from 'react'
import './AssistantFab.css'

const API = import.meta.env.VITE_API_URL || ''

export default function AssistantFab() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(false)

  const send = async () => {
    const msg = input.trim()
    if (!msg) return
    setLoading(true)
    setReply('')
    try {
      const res = await fetch(`${API}/api/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: msg }),
      })
      const data = await res.json()
      setReply(data.text || data.error || 'No response.')
      setInput('')
    } catch (e) {
      setReply('Error: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="assistant-fab-wrap">
      {open && (
        <div className="assistant-panel card">
          <div className="assistant-panel-header">
            <span>Assistant (Gemini via Backboard)</span>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>×</button>
          </div>
          <p className="assistant-hint">Ask or command (e.g. add $50 to food). Voice: ElevenLabs when configured.</p>
          {reply && <div className="assistant-reply">{reply}</div>}
          <input
            className="input"
            placeholder="Ask or command..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
          />
          <button type="button" className="btn btn-primary" onClick={send} disabled={loading || !input.trim()}>
            {loading ? '...' : 'Send'}
          </button>
        </div>
      )}
      <button
        type="button"
        className="assistant-fab"
        onClick={() => setOpen(!open)}
        title="AI Assistant"
      >
        ◆
      </button>
    </div>
  )
}
