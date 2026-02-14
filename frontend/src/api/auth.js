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

export async function register(emailOrUsername, password) {
  const body = { password }
  if (emailOrUsername.includes('@')) body.email = emailOrUsername
  else body.username = emailOrUsername
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
