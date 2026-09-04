import { useEffect, useState } from 'react'
import { fetchOpenRouterUsage, type OpenRouterUsage } from '../lib/openrouterApi'

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function OpenRouterUsageBar() {
  const [usage, setUsage] = useState<OpenRouterUsage | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchOpenRouterUsage()
      .then(setUsage)
      .catch(() => setError("Couldn't load OpenRouter usage."))
  }, [])

  if (error) {
    return <div className="openrouter-bar openrouter-bar--error">{error}</div>
  }
  if (!usage) return null

  return (
    <div className="openrouter-bar">
      <span className="openrouter-bar__label">OpenRouter</span>
      {usage.limitRemaining !== null && (
        <span>{currencyFormatter.format(usage.limitRemaining)} remaining</span>
      )}
      <span>{currencyFormatter.format(usage.usageWeekly)} used this week</span>
    </div>
  )
}
