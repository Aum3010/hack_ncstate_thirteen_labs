const API = import.meta.env.VITE_API_URL || ''

function credentials() {
  return { credentials: 'include' }
}

export async function getScenarioIntelligence(payload) {
  const res = await fetch(`${API}/api/whatif/scenario`, {
    ...credentials(),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Failed to load scenario intelligence')
  return res.json()
}

export async function getWhatIfConfig() {
  const res = await fetch(`${API}/api/whatif/config`, credentials())
  if (!res.ok) throw new Error('Failed to load scenario config')
  return res.json()
}
