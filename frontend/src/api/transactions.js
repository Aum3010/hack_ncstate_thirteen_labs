const API = import.meta.env.VITE_API_URL || ''

function credentials() {
  return { credentials: 'include' }
}

export async function listTransactions() {
  const res = await fetch(`${API}/api/transactions/`, credentials())
  if (!res.ok) throw new Error('Failed to load transactions')
  const data = await res.json()
  return data.transactions || []
}

export async function createTransaction(tx) {
  const res = await fetch(`${API}/api/transactions/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...credentials(),
    body: JSON.stringify(tx),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to add transaction')
  }
  return res.json()
}
