import { useState, useEffect } from 'react'
import { getSpendingAnalysis } from '../api/portfolio'

export default function useSpendingAnalysis() {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSpendingAnalysis()
      .then(setAnalysis)
      .catch(() => setAnalysis(null))
      .finally(() => setLoading(false))
  }, [])

  const savings = analysis?.savings || []
  const suggestions = analysis?.suggestions || []

  return { savings, suggestions, loading }
}
