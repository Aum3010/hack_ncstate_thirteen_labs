const API = import.meta.env.VITE_API_URL || ''

function credentials() {
  return { credentials: 'include' }
}

export async function getDashboardSummary() {
  const res = await fetch(`${API}/api/dashboard/summary`, credentials())
  if (!res.ok) throw new Error('Failed to load dashboard')
  return res.json()
}
