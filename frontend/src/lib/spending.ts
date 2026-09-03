import type { Transaction } from './financeApi'

export const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export interface CategoryTotal {
  category: string
  total: number
}

// dataviz: part-to-whole reads at a glance only up to ~6 segments — fold
// the tail into "Other" rather than seat a 6th+ named category.
const MAX_PIE_SEGMENTS = 6

// A transfer between your own accounts (paying off a credit card from
// checking) — the underlying purchases are already counted individually on
// the card side, so this isn't real spend or income and would double-count
// if included. Matched by the bank-generated name pattern only: neither
// Plaid category this shows up under ("Transfer" in practice, sometimes
// "Payment") is safe to exclude wholesale — both also hold real spend (a
// mis-categorized purchase, a recurring bill like rent, Zelle payments to
// other people). The same transfer posts on BOTH linked accounts — as an
// outflow on checking ("Mobile Banking payment to CRD ...", "Online Banking
// payment to CRD ...") and, with a matching confirmation number, as an
// inflow on the credit card ("PAYMENT FROM CHK ..."). Both sides must be
// excluded, or one side still double-counts as either spend or income.
function isCardPaymentTransfer(txn: Transaction): boolean {
  return /payment (to crd|from chk)\b/i.test(txn.name)
}

export function groupSpendingByCategory(transactions: Transaction[]): CategoryTotal[] {
  const totals = new Map<string, number>()
  for (const txn of transactions) {
    if (txn.amount <= 0) continue // Plaid convention: positive = spend, negative = credit/refund
    if (isCardPaymentTransfer(txn)) continue
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
    if (isCardPaymentTransfer(txn)) continue
    const key = periodKey(txn.date, period)
    totals.set(key, (totals.get(key) ?? 0) + txn.amount)
  }

  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, total]) => ({ label: periodLabel(key, period), total }))
}

// Keeps every transaction (spend and credits alike) that falls in the most
// recent week/month present in the data — "most recent we have data for",
// not "the real calendar's current week," so it stays correct against
// Sandbox test data that isn't necessarily dated near today.
export function filterToLatestPeriod(transactions: Transaction[], period: Period): Transaction[] {
  if (transactions.length === 0) return []
  const keys = transactions.map((txn) => periodKey(txn.date, period))
  const latestKey = keys.reduce((max, key) => (key > max ? key : max))
  return transactions.filter((_txn, index) => keys[index] === latestKey)
}

export function totalIncome(transactions: Transaction[], period: Period): number {
  return filterToLatestPeriod(transactions, period)
    .filter((txn) => txn.amount < 0 && !isCardPaymentTransfer(txn))
    .reduce((sum, txn) => sum + Math.abs(txn.amount), 0)
}
