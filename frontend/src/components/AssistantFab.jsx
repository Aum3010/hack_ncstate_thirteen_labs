import React, { useState, useEffect } from 'react'
import './AssistantFab.css'

const API = import.meta.env.VITE_API_URL || ''
const MODES = [
  { value: 'conservative', label: 'Conservative' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'aggressive', label: 'Aggressive' },
]

export default function AssistantFab() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('balanced')

  useEffect(() => {
    if (!open) return
    fetch(`${API}/api/users/me`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((user) => {
        if (user?.assistant_mode) setMode(user.assistant_mode)
      })
      .catch(() => {})
  }, [open])

  const persistMode = (newMode) => {
    setMode(newMode)
    fetch(`${API}/api/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ assistant_mode: newMode }),
    }).catch(() => {})
  }

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
        body: JSON.stringify({ message: msg, mode }),
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
          <div className="assistant-mode-selector">
            <span className="assistant-mode-label">Mode:</span>
            <select
              className="input assistant-mode-select"
              value={mode}
              onChange={(e) => persistMode(e.target.value)}
              aria-label="Assistant mode"
            >
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <p className="assistant-hint">Ask or command (e.g. add $50 to food). Voice (TTS/STT) will be integrated after the UI refactor so you can talk to the app end-to-end.</p>
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
