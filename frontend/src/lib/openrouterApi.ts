const OPENROUTER_STATUS_BASE_URL = import.meta.env.VITE_OPENROUTER_STATUS_BASE_URL ?? 'http://horong.taila5421b.ts.net:8768'

export interface OpenRouterUsage {
  limitRemaining: number | null
  usage: number
  usageDaily: number
  usageWeekly: number
  usageMonthly: number
  isFreeTier: boolean
}

export async function fetchOpenRouterUsage(): Promise<OpenRouterUsage> {
  const response = await fetch(`${OPENROUTER_STATUS_BASE_URL}/usage`)
  if (!response.ok) {
    throw new Error(`openrouter status API request failed: ${response.status}`)
  }
  const data = await response.json()
  return {
    limitRemaining: data.limit_remaining,
    usage: data.usage,
    usageDaily: data.usage_daily,
    usageWeekly: data.usage_weekly,
    usageMonthly: data.usage_monthly,
    isFreeTier: data.is_free_tier,
  }
}

export interface CurrentModel {
  model: string
  provider: string
}

export async function fetchCurrentModel(): Promise<CurrentModel> {
  const response = await fetch(`${OPENROUTER_STATUS_BASE_URL}/model`)
  if (!response.ok) {
    throw new Error(`openrouter status API request failed: ${response.status}`)
  }
  const data = await response.json()
  return { model: data.model, provider: data.provider }
}
