import { API } from './config'

export async function getReminders(days = 7) {
  const res = await fetch(`${API}/api/bills/reminders?days=${days}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to load reminders')
  const data = await res.json()
  return data.reminders || []
}
