const API = import.meta.env.VITE_API_URL || ''

function credentials() {
  return { credentials: 'include' }
}

export async function listPortfolioItems() {
  const res = await fetch(`${API}/api/portfolio/`, credentials())
  if (!res.ok) throw new Error('Failed to load portfolio items')
  const data = await res.json()
  return data.items || []
}

export async function createPortfolioItem(item) {
  const res = await fetch(`${API}/api/portfolio/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...credentials(),
    body: JSON.stringify(item),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to create portfolio item')
  }
  return res.json()
}

export async function updatePortfolioItem(id, patch) {
  const res = await fetch(`${API}/api/portfolio/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    ...credentials(),
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error('Failed to update portfolio item')
  return res.json()
}

export async function deletePortfolioItem(id) {
  const res = await fetch(`${API}/api/portfolio/${id}`, { method: 'DELETE', ...credentials() })
  if (!res.ok) throw new Error('Failed to delete portfolio item')
}

export async function generateDescription(id) {
  const res = await fetch(`${API}/api/portfolio/${id}/generate-description`, {
    method: 'POST',
    ...credentials(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to generate description')
  }
  return res.json()
}

export async function getPortfolioAllocation(goal, riskTolerance) {
  const res = await fetch(`${API}/api/portfolio/allocation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...credentials(),
    body: JSON.stringify({ goal, risk_tolerance: riskTolerance }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to generate allocation')
  }
  return res.json()
}

export async function getSpendingAnalysis() {
  const res = await fetch(`${API}/api/portfolio/spending-analysis`, credentials())
  if (!res.ok) throw new Error('Failed to load spending analysis')
  return res.json()
}

export async function portfolioChat(messageOrPayload, mode, messages = null) {
  const payload = typeof messageOrPayload === 'object' && messageOrPayload !== null
    ? messageOrPayload
    : { message: messageOrPayload, mode, messages }
  const res = await fetch(`${API}/api/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...credentials(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Chat failed')
  return res.json()
}

export async function textToSpeech(text) {
  const res = await fetch(`${API}/api/assistant/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...credentials(),
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error('TTS failed')
  return res.json()
}
