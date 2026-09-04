import { useCallback, useEffect, useState } from 'react'
import { fetchOpenRouterUsage, type OpenRouterUsage } from '../lib/openrouterApi'

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function OpenRouterUsageBar() {
  const [usage, setUsage] = useState<OpenRouterUsage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const loadUsage = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchOpenRouterUsage()
      setUsage(result)
      setError(null)
    } catch {
      setError("Couldn't load OpenRouter usage.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsage()
  }, [loadUsage])

  return (
    <div className="openrouter-bar">
      <span className="openrouter-bar__label">OpenRouter</span>
      {error && <span className="openrouter-bar__error">{error}</span>}
      {!error && usage && usage.limitRemaining !== null && (
        <span>{currencyFormatter.format(usage.limitRemaining)} remaining</span>
      )}
      {!error && usage && <span>{currencyFormatter.format(usage.usageWeekly)} used this week</span>}
      <button
        type="button"
        className="openrouter-bar__refresh"
        onClick={loadUsage}
        disabled={loading}
        aria-label="Refresh OpenRouter usage"
      >
        ↻
      </button>
    </div>
  )
}
