import { API } from './config'

export async function getExperiences(location) {
  const params = location ? `?location=${encodeURIComponent(location)}` : ''
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const res = await fetch(`${API}/api/experiences/${params}`, {
      credentials: 'include',
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const msg = err.error || `Failed to load experiences (${res.status})`
      if (res.status === 401) {
        throw new Error('Please log in to view experiences.')
      }
      if (res.status >= 500) {
        throw new Error('Server error. Try again later.')
      }
      throw new Error(msg)
    }
    return res.json()
  } catch (e) {
    clearTimeout(timeoutId)
    if (e.name === 'AbortError') {
      throw new Error('Request timed out. Try again.')
    }
    if (e instanceof TypeError && e.message === 'Failed to fetch') {
      throw new Error('Cannot reach the server. Try refreshing the page.')
    }
    throw e
  }
}
