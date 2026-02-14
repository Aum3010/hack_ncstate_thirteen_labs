const API = import.meta.env.VITE_API_URL || ''

function credentials() {
  return { credentials: 'include' }
}

export async function getInsights() {
  const res = await fetch(`${API}/api/insights/`, credentials())
  if (!res.ok) throw new Error('Failed to load insights')
  const data = await res.json()
  return data.insights || []
}
