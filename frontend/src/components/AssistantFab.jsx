import React, { useState, useEffect, useRef } from 'react'
import './AssistantFab.css'

import { API } from '../api/config'
import { speechToText, textToSpeech, playTTSFromResponse } from '../api/assistant'

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
  const [voiceState, setVoiceState] = useState('idle') // idle | recording | processing | playing
  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])

  useEffect(() => {
    if (!open) return
    fetch(`${API}/api/users/me`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((user) => {
        if (user?.assistant_mode) setMode(user.assistant_mode)
      })
      .catch(() => {})
  }, [open])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try { recorderRef.current.stop() } catch (_) {}
        recorderRef.current = null
      }
    }
  }, [])

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
      const data = await res.json().catch(() => ({}))
      const replyText = res.ok
        ? (data.text || data.error || 'No response.')
        : (data.error || data.text || res.statusText || 'Chat failed')
      setReply(replyText)
      setInput('')
    } catch (e) {
      setReply('Error: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const startVoice = async () => {
    if (voiceState !== 'idle') return
    setReply('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        recorderRef.current = null
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setVoiceState('processing')
        try {
          const { text } = await speechToText(blob)
          if (!text || !text.trim()) {
            setReply("Couldn't hear you. Try again.")
            setVoiceState('idle')
            return
          }
          setInput(text)
          const res = await fetch(`${API}/api/assistant/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ message: text.trim(), mode }),
          })
          const data = await res.json().catch(() => ({}))
          const replyText = res.ok
            ? (data.text || data.error || 'No response.')
            : (data.error || data.text || res.statusText || 'Chat failed')
          setReply(replyText)
          setVoiceState('playing')
          const ttsData = await textToSpeech(replyText).catch(() => null)
          if (ttsData?.audio_url) {
            await playTTSFromResponse(ttsData).catch(() => {})
          }
        } catch (e) {
          setReply(e.message === 'STT failed' ? "Couldn't hear you." : 'Error: ' + e.message)
        } finally {
          setVoiceState('idle')
        }
      }
      recorder.start()
      setVoiceState('recording')
    } catch (e) {
      setReply(e.name === 'NotAllowedError' ? 'Microphone access denied.' : 'Error: ' + e.message)
      setVoiceState('idle')
    }
  }

  const stopVoice = () => {
    if (voiceState !== 'recording') return
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }

  const toggleVoice = () => {
    if (voiceState === 'recording') stopVoice()
    else if (voiceState === 'idle') startVoice()
  }

  const voiceLabel =
    voiceState === 'recording' ? 'Stop (send)' :
    voiceState === 'processing' ? 'Processing...' :
    voiceState === 'playing' ? 'Speaking...' : 'Speak'

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
              className={`btn assistant-mic ${voiceState === 'recording' ? 'assistant-mic-recording' : ''}`}
              onClick={toggleVoice}
              disabled={loading || voiceState === 'processing' || voiceState === 'playing'}
              title={voiceLabel}
              aria-label={voiceLabel}
            >
              {voiceState === 'recording' ? '■' : '🎤'}
            </button>
            <input
              className="input"
              placeholder="Ask or command..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
            />
            <button type="button" className="btn btn-primary" onClick={send} disabled={loading || !input.trim() || voiceState === 'recording'}>
              {loading ? '...' : 'Send'}
            </button>
          </div>
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
