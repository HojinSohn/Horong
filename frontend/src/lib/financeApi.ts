const FINANCE_BASE_URL = import.meta.env.VITE_FINANCE_BASE_URL ?? 'http://100.109.58.59:8766'

export interface Transaction {
  id: string
  date: string
  name: string
  amount: number
  category: string | null
  pending: boolean
}

export interface TransactionsResponse {
  linked: boolean
  needsReauth: boolean
  transactions: Transaction[]
}

export async function fetchLinkToken(): Promise<string> {
  const response = await fetch(`${FINANCE_BASE_URL}/link/token`, { method: 'POST' })
  if (!response.ok) {
    throw new Error(`finance API request failed: ${response.status}`)
  }
  const data = await response.json()
  return data.link_token
}

export async function exchangePublicToken(publicToken: string): Promise<void> {
  const response = await fetch(`${FINANCE_BASE_URL}/link/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ public_token: publicToken }),
  })
  if (!response.ok) {
    throw new Error(`finance API request failed: ${response.status}`)
  }
}

export async function fetchTransactions(): Promise<TransactionsResponse> {
  const response = await fetch(`${FINANCE_BASE_URL}/transactions`)
  if (!response.ok) {
    throw new Error(`finance API request failed: ${response.status}`)
  }
  const data = await response.json()
  return { linked: data.linked, needsReauth: data.needs_reauth, transactions: data.transactions }
}
