import React, { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import './ChatBar.css'

import { API } from '../api/config'
import useVoiceAssistant from '../hooks/useVoiceAssistant'
const MODES = [
  { value: 'conservative', label: 'Conservative' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'aggressive', label: 'Aggressive' },
]

const routeToPage = (pathname) => {
  if (pathname === '/' || pathname === '') return 'dashboard'
  const p = pathname.replace(/^\//, '')
  return p || 'dashboard'
}

export default function ChatBar() {
  const location = useLocation()
  const [expanded, setExpanded] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('balanced')
  const threadEndRef = useRef(null)
  const { micState, assistantAudio, voiceError, toggleRecording, speakText } = useVoiceAssistant()

  useEffect(() => {
    fetch(`${API}/api/users/me`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((user) => {
        if (user?.assistant_mode) setMode(user.assistant_mode)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const persistMode = (newMode) => {
    setMode(newMode)
    fetch(`${API}/api/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ assistant_mode: newMode }),
    }).catch(() => {})
  }

  const CHAT_TIMEOUT_MS = 60000

  const send = async (textOverride = null) => {
    const msg = (textOverride ?? input).trim()
    if (!msg) return
    const page = routeToPage(location.pathname)
    if (textOverride == null) setInput('')
    setMessages((prev) => [...prev, { role: 'user', text: msg }])
    setLoading(true)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS)
    try {
      const res = await fetch(`${API}/api/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: msg, mode, route: location.pathname, context: { page } }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      const data = await res.json().catch(() => ({}))
      const replyText = res.ok
        ? (data.text || data.error || 'No response.')
        : (data.error || data.text || res.statusText || 'Chat failed')
      setMessages((prev) => [...prev, { role: 'assistant', text: replyText }])
      if (res.ok && replyText) {
        speakText(replyText).catch(() => {})
      }
    } catch (e) {
      clearTimeout(timeoutId)
      const errorMsg = e.name === 'AbortError'
        ? 'Request timed out. Check BACKBOARD_API_KEY and try again.'
        : (e.message || 'Chat failed')
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Error: ' + errorMsg }])
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
    <div className="chatbar-wrap">
      {expanded && (
        <div className="chatbar-thread">
          <div className="chatbar-thread-header">
            <span className="chatbar-thread-title">Assistant</span>
            <div className="chatbar-mode-selector">
              <select
                className="input chatbar-mode-select"
                value={mode}
                onChange={(e) => persistMode(e.target.value)}
                aria-label="Assistant mode"
              >
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <button type="button" className="btn btn-ghost chatbar-close" onClick={() => setExpanded(false)} aria-label="Collapse">−</button>
          </div>
          <div className="chatbar-messages">
            {messages.length === 0 && (
              <p className="chatbar-placeholder">Ask or command (e.g. add $50 to food). Responses are tailored to the page you’re on.</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chatbar-msg chatbar-msg-${m.role}`}>
                {m.text}
              </div>
            ))}
            {loading && <div className="chatbar-msg chatbar-msg-assistant chatbar-typing">...</div>}
            <div ref={threadEndRef} />
          </div>
        </div>
      )}
      <div className="chatbar-input-row">
        <button
          type="button"
          className="chatbar-expand-btn btn btn-ghost"
          onClick={() => setExpanded(!expanded)}
          title={expanded ? 'Collapse' : 'Show conversation'}
          aria-label={expanded ? 'Collapse' : 'Show conversation'}
        >
          {expanded ? '−' : '+'}
        </button>
        <input
          className="input chatbar-input"
          placeholder="Ask or command..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
        />
        <button
          type="button"
          className={`btn btn-ember chatbar-send chatbar-mic ${micState === 'recording' ? 'chatbar-mic-recording' : ''}`}
          onClick={handleVoiceInput}
          disabled={loading || micState === 'processing'}
          aria-label="Voice input"
          title={micState === 'recording' ? 'Stop recording' : micState === 'processing' ? 'Processing voice' : 'Voice input'}
        >
          {micState === 'recording' ? '■' : micState === 'processing' ? '...' : '🎤'}
        </button>
        <button
          type="button"
          className="btn btn-ember chatbar-send chatbar-speak"
          onClick={handleSpeakInput}
          disabled={loading || micState === 'processing' || assistantAudio === 'playing' || !input.trim()}
          aria-label="Speak text"
          title={assistantAudio === 'playing' ? 'Playing audio' : 'Speak typed text'}
        >
          {assistantAudio === 'playing' ? '...' : '🔊'}
        </button>
        <button
          type="button"
          className="btn btn-ember chatbar-send"
          onClick={() => send()}
          disabled={loading || micState === 'processing' || !input.trim()}
        >
          {loading ? '...' : 'Send'}
        </button>
      </div>
      {voiceError ? <div className="chatbar-voice-error">{voiceError}</div> : null}
    </div>
  )
}
