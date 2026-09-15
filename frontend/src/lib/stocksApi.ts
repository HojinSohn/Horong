const STOCKS_BASE_URL = import.meta.env.VITE_STOCKS_BASE_URL ?? 'http://horong.taila5421b.ts.net:8769'

export interface Quote {
  symbol: string
  price: number | null
  change: number | null
  changePercent: number | null
}

export async function fetchTickers(): Promise<string[]> {
  const response = await fetch(`${STOCKS_BASE_URL}/tickers`)
  if (!response.ok) {
    throw new Error(`stocks API request failed: ${response.status}`)
  }
  return response.json()
}

export async function addTicker(symbol: string): Promise<void> {
  const response = await fetch(`${STOCKS_BASE_URL}/tickers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol }),
  })
  if (!response.ok) {
    throw new Error(`stocks API request failed: ${response.status}`)
  }
}

export async function deleteTicker(symbol: string): Promise<void> {
  const response = await fetch(`${STOCKS_BASE_URL}/tickers/${symbol}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error(`stocks API request failed: ${response.status}`)
  }
}

export async function fetchQuotes(): Promise<Quote[]> {
  const response = await fetch(`${STOCKS_BASE_URL}/quotes`)
  if (!response.ok) {
    throw new Error(`stocks API request failed: ${response.status}`)
  }
  return response.json()
}
