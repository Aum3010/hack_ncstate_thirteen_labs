const API = import.meta.env.VITE_API_URL || ''

export async function getReminders(days = 7) {
  const res = await fetch(`${API}/api/bills/reminders?days=${days}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to load reminders')
  const data = await res.json()
  return data.reminders || []
}
