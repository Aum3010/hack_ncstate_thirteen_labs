import { API } from './config'

function credentials() {
  return { credentials: 'include' }
}

export async function listWallets() {
  const res = await fetch(`${API}/api/wallets/`, credentials())
  if (!res.ok) throw new Error('Failed to load wallets')
  const data = await res.json()
  return data.wallets || []
}

export async function syncWallet(walletId) {
  const res = await fetch(`${API}/api/wallets/${walletId}/sync`, {
    method: 'POST',
    ...credentials(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Sync failed')
  }
  return res.json()
}

export async function disconnectWallet(walletId) {
  const res = await fetch(`${API}/api/wallets/${walletId}`, {
    method: 'DELETE',
    ...credentials(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to disconnect wallet')
  }
  return res.json()
}
