import type { Transaction } from './financeApi'

export const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export interface CategoryTotal {
  category: string
  total: number
}

// dataviz: part-to-whole reads at a glance only up to ~6 segments — fold
// the tail into "Other" rather than seat a 6th+ named category.
const MAX_PIE_SEGMENTS = 6

export function groupSpendingByCategory(transactions: Transaction[]): CategoryTotal[] {
  const totals = new Map<string, number>()
  for (const txn of transactions) {
    if (txn.amount <= 0) continue // Plaid convention: positive = spend, negative = credit/refund
    const category = txn.category ?? 'Uncategorized'
    totals.set(category, (totals.get(category) ?? 0) + txn.amount)
  }

  const sorted = [...totals.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)

  if (sorted.length <= MAX_PIE_SEGMENTS) return sorted

  const head = sorted.slice(0, MAX_PIE_SEGMENTS - 1)
  const tail = sorted.slice(MAX_PIE_SEGMENTS - 1)
  const otherTotal = tail.reduce((sum, entry) => sum + entry.total, 0)
  return [...head, { category: 'Other', total: otherTotal }]
}

export type Period = 'week' | 'month'

export interface PeriodTotal {
  label: string
  total: number
}

const monthLabelFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
const weekLabelFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

function startOfWeekUTC(date: Date): string {
  const day = date.getUTCDay() // 0 = Sunday
  const diffToMonday = day === 0 ? 6 : day - 1
  const start = new Date(date)
  start.setUTCDate(date.getUTCDate() - diffToMonday)
  return start.toISOString().slice(0, 10)
}

function periodKey(isoDate: string, period: Period): string {
  if (period === 'month') return isoDate.slice(0, 7)
  return startOfWeekUTC(new Date(`${isoDate}T00:00:00Z`))
}

function periodLabel(key: string, period: Period): string {
  const asDate = new Date(`${period === 'month' ? `${key}-01` : key}T00:00:00Z`)
  return period === 'month' ? monthLabelFormatter.format(asDate) : weekLabelFormatter.format(asDate)
}

export function groupSpendingByPeriod(transactions: Transaction[], period: Period): PeriodTotal[] {
  const totals = new Map<string, number>()
  for (const txn of transactions) {
    if (txn.amount <= 0) continue
    const key = periodKey(txn.date, period)
    totals.set(key, (totals.get(key) ?? 0) + txn.amount)
  }

  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, total]) => ({ label: periodLabel(key, period), total }))
}
