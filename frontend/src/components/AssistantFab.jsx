import React, { useState, useEffect, useRef } from 'react'
import './AssistantFab.css'

import { API } from '../api/config'
import useVoiceAssistant from '../hooks/useVoiceAssistant'

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
  const { micState, assistantAudio, voiceError, toggleRecording, speakText } = useVoiceAssistant()

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

  const send = async (textOverride = null) => {
    const msg = (textOverride ?? input).trim()
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
      const data = await res.json().catch(() => ({}))
      const replyText = res.ok
        ? (data.text || data.error || 'No response.')
        : (data.error || data.text || res.statusText || 'Chat failed')
      setReply(replyText)
      if (textOverride == null) setInput('')
      if (res.ok && replyText) {
        speakText(replyText).catch(() => {})
      }
    } catch (e) {
      setReply('Error: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleVoice = async () => {
    setReply('')
    await toggleRecording(async (transcript) => {
      setInput(transcript)
      await send(transcript)
    }, 7000)
  }

  const voiceLabel =
    micState === 'recording' ? 'Stop recording' :
    micState === 'processing' ? 'Processing voice' :
    assistantAudio === 'playing' ? 'Speaking...' : 'Voice input'

  const handleSpeakInput = async () => {
    const text = input.trim()
    if (!text) return
    await speakText(text).catch(() => {})
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
          <p className="assistant-hint">Ask or command (e.g. add $50 to food). Use the mic to speak and hear the reply.</p>
          {reply && <div className="assistant-reply">{reply}</div>}
          <div className="assistant-voice-row">
            <button
              type="button"
              className={`btn assistant-mic ${micState === 'recording' ? 'assistant-mic-recording' : ''}`}
              onClick={toggleVoice}
              disabled={loading || micState === 'processing'}
              title={voiceLabel}
              aria-label="Voice input"
            >
              {micState === 'recording' ? '■' : micState === 'processing' ? '...' : '🎤'}
            </button>
            <input
              className="input"
              placeholder="Ask or command..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSpeakInput}
              disabled={loading || micState === 'processing' || assistantAudio === 'playing' || !input.trim()}
              aria-label="Speak text"
              title={assistantAudio === 'playing' ? 'Playing audio' : 'Speak typed text'}
            >
              {assistantAudio === 'playing' ? '...' : '🔊'}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => send()} disabled={loading || micState === 'processing' || !input.trim() || micState === 'recording'}>
              {loading ? '...' : 'Send'}
            </button>
          </div>
          {voiceError ? <div className="assistant-hint" style={{ color: 'var(--neon-pink)', marginTop: '0.5rem', marginBottom: 0 }}>{voiceError}</div> : null}
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
