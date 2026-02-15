import { API } from './config'

function credentials() {
  return { credentials: 'include' }
}

export async function listTransactions(params = {}) {
  const qs = new URLSearchParams()
  if (params.limit) qs.set('limit', String(params.limit))
  if (params.offset) qs.set('offset', String(params.offset))
  if (params.date) qs.set('date', params.date)
  const res = await fetch(`${API}/api/transactions/${qs.toString() ? `?${qs.toString()}` : ''}`, credentials())
  if (!res.ok) throw new Error('Failed to load transactions')
  const data = await res.json()
  return data
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
