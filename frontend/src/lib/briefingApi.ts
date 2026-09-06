const BRIEFING_BASE_URL = import.meta.env.VITE_BRIEFING_BASE_URL ?? 'http://100.109.58.59:8768'

export interface Briefing {
  text: string
  createdAt: string
}

export async function fetchLatestBriefing(): Promise<Briefing | null> {
  const response = await fetch(`${BRIEFING_BASE_URL}/briefing/latest`)
  if (!response.ok) {
    throw new Error(`briefing API request failed: ${response.status}`)
  }
  const data = await response.json()
  if (data.briefing === null) return null
  return { text: data.text, createdAt: data.created_at }
}
