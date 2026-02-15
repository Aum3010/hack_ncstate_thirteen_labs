import { API } from './config'

function credentials() {
  return { credentials: 'include' }
}

export async function listBills() {
  const res = await fetch(`${API}/api/bills/`, credentials())
  if (!res.ok) throw new Error('Failed to load bills')
  const data = await res.json()
  return data.bills || []
}

export async function createBill(bill) {
  const res = await fetch(`${API}/api/bills/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...credentials(),
    body: JSON.stringify(bill),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to create bill')
  }
  return res.json()
}

export async function updateBill(id, patch) {
  const res = await fetch(`${API}/api/bills/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    ...credentials(),
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error('Failed to update bill')
  return res.json()
}

export async function deleteBill(id) {
  const res = await fetch(`${API}/api/bills/${id}`, { method: 'DELETE', ...credentials() })
  if (!res.ok) throw new Error('Failed to delete bill')
}

export async function markPaid(id, paid = true) {
  return updateBill(id, { paid_at: paid ? new Date().toISOString() : null })
}
