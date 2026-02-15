import { connectPhantom, getPhantomProvider, getPhantomAddress } from './phantom'

const API = import.meta.env.VITE_API_URL || ''

function credentials() {
  return { credentials: 'include' }
}

export async function getMe() {
  const res = await fetch(`${API}/api/auth/me`, credentials())
  const data = await res.json()
  return data
}

export async function login(emailOrUsername, password) {
  const body = { password }
  if (emailOrUsername.includes('@')) body.email = emailOrUsername
  else body.username = emailOrUsername
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...credentials(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Login failed')
  }
  return res.json()
}

export async function register(email, password, username = null) {
  const body = { email: (email || '').trim(), password }
  if (username && String(username).trim()) body.username = String(username).trim()
  const res = await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...credentials(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Registration failed')
  }
  return res.json()
}

export async function logout() {
  await fetch(`${API}/api/auth/logout`, { method: 'POST', ...credentials() })
}

export async function connectWallet(address) {
  const res = await fetch(`${API}/api/auth/wallet/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...credentials(),
    body: JSON.stringify({ address }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to link wallet')
  }
  return res.json()
}

/** Convert Uint8Array to base64. */
function toBase64(u8) {
  let binary = ''
  for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i])
  return typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(u8).toString('base64')
}

/**
 * Sign in with Phantom wallet. Uses existing connection if already connected to avoid "app already in use".
 * @returns {{ user }} - user may have email null (redirect to profile)
 */
export async function loginWithPhantom() {
  const provider = getPhantomProvider()
  if (!provider) throw new Error('Phantom wallet not installed')
  let address = getPhantomAddress()
  if (!address) {
    const res = await connectPhantom()
    address = res.address
  }

  const challengeRes = await fetch(`${API}/api/auth/solana/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...credentials(),
  })
  if (!challengeRes.ok) throw new Error('Failed to get sign-in challenge')
  const { message } = await challengeRes.json()
  if (!message) throw new Error('Invalid challenge')

  const encodedMessage = new TextEncoder().encode(message)
  const signResult = await provider.signMessage(encodedMessage, 'utf8')
  const sig = signResult?.signature
  const signature = typeof sig === 'string' ? sig : (sig && sig.length === 64 ? toBase64(sig) : null)
  if (!signature) throw new Error('No signature from wallet')

  const res = await fetch(`${API}/api/auth/solana/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...credentials(),
    body: JSON.stringify({ address, message, signature }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Sign in failed')
  }
  return res.json()
}
