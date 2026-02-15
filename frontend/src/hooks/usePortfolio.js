import { useState, useMemo } from 'react'
import { getPortfolioAllocation } from '../api/portfolio'

export default function usePortfolio() {
  const [goalInput, setGoalInput] = useState('')
  const [risk, setRisk] = useState('balanced')
  const [allocation, setAllocation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const generateAllocation = async (e, options = {}) => {
    if (e?.preventDefault) e.preventDefault()
    const goal = (options.goal ?? goalInput).trim()
    const riskTolerance = options.risk ?? risk
    if (!goal) return
    setLoading(true)
    setError('')
    try {
      const data = await getPortfolioAllocation(goal, riskTolerance)
      setAllocation(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const pieData = useMemo(() => {
    if (!allocation?.categories) return []
    return allocation.categories.map((c) => ({
      name: c.name,
      value: c.percentage,
      fill: c.color,
    }))
  }, [allocation])

  return {
    goalInput,
    setGoalInput,
    risk,
    setRisk,
    allocation,
    pieData,
    loading,
    error,
    generateAllocation,
  }
}
