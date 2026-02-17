const API = import.meta.env.VITE_API_URL || ''

function credentials() {
  return { credentials: 'include' }
}

export async function optimizeAllocation(payload) {
  const res = await fetch(`${API}/api/optimizer/optimize`, {
    ...credentials(),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Failed to optimize allocation')
  return res.json()
}

