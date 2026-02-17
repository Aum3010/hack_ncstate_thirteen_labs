import React from 'react'

export default function PortfolioAssistantPanel({
  messages,
  loading,
  input,
  setInput,
  send,
  onVoiceInput,
  onSpeakInput,
  micState,
  assistantAudio,
  voiceError,
  chatMessagesRef,
}) {
  return (
    <div className="card portfolio-explain-card">
      <h2 className="section-title">Chart Explanation & Q&A</h2>
      <div className="portfolio-chat-messages" ref={chatMessagesRef}>
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
          placeholder="Ask about this allocation..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          disabled={loading}
        />
        <button
          type="button"
          className={`btn btn-primary portfolio-chat-mic ${micState === 'recording' ? 'portfolio-chat-mic-recording' : ''}`}
          onClick={onVoiceInput}
          disabled={loading || micState === 'processing'}
          aria-label="Voice input"
          title={micState === 'recording' ? 'Stop recording' : micState === 'processing' ? 'Processing voice' : 'Voice input'}
        >
          {micState === 'recording' ? '■' : micState === 'processing' ? '...' : '🎤'}
        </button>
        <button
          type="button"
          className="btn btn-primary portfolio-chat-speak"
          onClick={onSpeakInput}
          disabled={loading || micState === 'processing' || assistantAudio === 'playing' || !input.trim()}
          aria-label="Speak text"
          title={assistantAudio === 'playing' ? 'Playing audio' : 'Speak typed text'}
        >
          {assistantAudio === 'playing' ? '...' : '🔊'}
        </button>
        <button type="button" className="btn btn-primary" onClick={send} disabled={loading || micState === 'processing' || !input.trim()}>
          {loading ? '...' : 'Send'}
        </button>
      </div>
      {voiceError ? <p className="portfolio-voice-error">{voiceError}</p> : null}
    </div>
  )
}
