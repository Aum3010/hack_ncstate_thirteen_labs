const API = import.meta.env.VITE_API_URL || ''

function credentials() {
  return { credentials: 'include' }
}

export async function listGoals() {
  const res = await fetch(`${API}/api/goals/`, credentials())
  if (!res.ok) throw new Error('Failed to load goals')
  const data = await res.json()
  return data.goals || []
}

export async function createGoal(goal) {
  const res = await fetch(`${API}/api/goals/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...credentials(),
    body: JSON.stringify(goal),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to create goal')
  }
  return res.json()
}

export async function updateGoal(id, patch) {
  const res = await fetch(`${API}/api/goals/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    ...credentials(),
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error('Failed to update goal')
  return res.json()
}

export async function deleteGoal(id) {
  const res = await fetch(`${API}/api/goals/${id}`, { method: 'DELETE', ...credentials() })
  if (!res.ok) throw new Error('Failed to delete goal')
}
