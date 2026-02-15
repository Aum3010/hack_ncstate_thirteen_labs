const API = import.meta.env.VITE_API_URL || ''

// Empty API = relative URLs; correct when using Vite proxy (Docker)

export async function getExperiences(location) {
  const params = location ? `?location=${encodeURIComponent(location)}` : ''
  try {
    const res = await fetch(`${API}/api/experiences${params}`, { credentials: 'include' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Failed to load experiences (${res.status})`)
    }
    return res.json()
  } catch (e) {
    if (e instanceof TypeError && e.message === 'Failed to fetch') {
      throw new Error('Cannot reach the server. Try refreshing the page.')
    }
    throw e
  }
}
