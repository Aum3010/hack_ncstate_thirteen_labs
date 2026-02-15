const API = import.meta.env.VITE_API_URL || ''

function credentials() {
  return { credentials: 'include' }
}

/** Fetch current user profile (includes profile_questionnaire, onboarding_answers). */
export async function getProfile() {
  const res = await fetch(`${API}/api/users/me`, { ...credentials() })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to load profile')
  }
  return res.json()
}

export async function updateMe(patch) {
  const res = await fetch(`${API}/api/users/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    ...credentials(),
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to update profile')
  }
  return res.json()
}
