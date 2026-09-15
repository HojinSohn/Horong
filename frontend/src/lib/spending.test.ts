import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  filterToLatestPeriod,
  groupSpendingByCategory,
  groupSpendingByPeriod,
  latestPeriodLabel,
  totalIncome,
  totalSpending,
} from './spending'
import type { Transaction } from './financeApi'

function txn(overrides: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(),
    date: '2026-08-01',
    name: 'Test',
    amount: 10,
    category: 'Food and Drink',
    pending: false,
    ...overrides,
  }
}

describe('groupSpendingByCategory', () => {
  it('sums spend per category and sorts descending', () => {
    const result = groupSpendingByCategory([
      txn({ category: 'Travel', amount: 500 }),
      txn({ category: 'Food and Drink', amount: 12 }),
      txn({ category: 'Travel', amount: 100 }),
    ])

    expect(result).toEqual([
      { category: 'Travel', total: 600 },
      { category: 'Food and Drink', total: 12 },
    ])
  })

  it('excludes credits/refunds (negative amounts) from spend totals', () => {
    const result = groupSpendingByCategory([
      txn({ category: 'Travel', amount: 500 }),
      txn({ category: 'Travel', amount: -500 }),
    ])

    expect(result).toEqual([{ category: 'Travel', total: 500 }])
  })

  it('labels a missing category as Uncategorized', () => {
    const result = groupSpendingByCategory([txn({ category: null, amount: 20 })])

    expect(result).toEqual([{ category: 'Uncategorized', total: 20 }])
  })

  it('excludes checking-to-card transfers by name, regardless of category or which bank-app prefix they use', () => {
    const result = groupSpendingByCategory([
      txn({
        category: 'Transfer',
        amount: 166.79,
        name: 'Mobile Banking payment to CRD 1729 Confirmation# zvw4vfdia',
      }),
      txn({
        category: 'Payment',
        amount: 1050.62,
        name: 'Online Banking payment to CRD 1729 Confirmation# z71g6b9b2',
      }),
      txn({ category: 'Food and Drink', amount: 12 }),
    ])

    expect(result).toEqual([{ category: 'Food and Drink', total: 12 }])
  })

  it('keeps other spend that shares a category with the excluded transfer but isn\'t one (e.g. rent under "Payment", a mis-categorized purchase or a Zelle payment under "Transfer")', () => {
    const result = groupSpendingByCategory([
      txn({ category: 'Payment', amount: 704.99, name: 'PURCHASE 0814 APF*Crestview Managemen' }),
      txn({ category: 'Transfer', amount: 8.5, name: 'ARA PURDUE BOILERMAKER MK' }),
      txn({ category: 'Transfer', amount: 40, name: 'Zelle payment to SUKMIN for "Pott"; Conf# xy880uh0i' }),
    ])

    expect(result).toEqual([
      { category: 'Payment', total: 704.99 },
      { category: 'Transfer', total: 48.5 },
    ])
  })

  it('folds categories beyond the top 5 into Other', () => {
    const result = groupSpendingByCategory([
      txn({ category: 'A', amount: 60 }),
      txn({ category: 'B', amount: 50 }),
      txn({ category: 'C', amount: 40 }),
      txn({ category: 'D', amount: 30 }),
      txn({ category: 'E', amount: 20 }),
      txn({ category: 'F', amount: 10 }),
      txn({ category: 'G', amount: 5 }),
    ])

    expect(result).toEqual([
      { category: 'A', total: 60 },
      { category: 'B', total: 50 },
      { category: 'C', total: 40 },
      { category: 'D', total: 30 },
      { category: 'E', total: 20 },
      { category: 'Other', total: 15 },
    ])
  })
})

describe('groupSpendingByPeriod', () => {
  it('sums spend per month, sorted chronologically, with a short month/year label', () => {
    const result = groupSpendingByPeriod(
      [
        txn({ date: '2026-08-05', amount: 100 }),
        txn({ date: '2026-08-20', amount: 50 }),
        txn({ date: '2026-07-15', amount: 20 }),
      ],
      'month',
    )

    expect(result).toEqual([
      { label: 'Jul 2026', total: 20 },
      { label: 'Aug 2026', total: 150 },
    ])
  })

  it('sums spend per day, sorted chronologically, with a short date label', () => {
    const result = groupSpendingByPeriod(
      [
        txn({ date: '2026-08-10', amount: 30 }),
        txn({ date: '2026-08-10', amount: 20 }),
        txn({ date: '2026-08-03', amount: 15 }),
      ],
      'day',
    )

    expect(result).toEqual([
      { label: 'Aug 3', total: 15 },
      { label: 'Aug 10', total: 50 },
    ])
  })

  it('sums spend per week (Monday-start), sorted chronologically, with a short date label', () => {
    // 2026-08-10 is a Monday; 2026-08-11 falls in the same week.
    const result = groupSpendingByPeriod(
      [
        txn({ date: '2026-08-10', amount: 30 }),
        txn({ date: '2026-08-11', amount: 20 }),
        txn({ date: '2026-08-03', amount: 15 }),
      ],
      'week',
    )

    expect(result).toEqual([
      { label: 'Aug 3', total: 15 },
      { label: 'Aug 10', total: 50 },
    ])
  })

  it('excludes credits/refunds from period totals', () => {
    const result = groupSpendingByPeriod(
      [txn({ date: '2026-08-10', amount: 100 }), txn({ date: '2026-08-10', amount: -100 })],
      'month',
    )

    expect(result).toEqual([{ label: 'Aug 2026', total: 100 }])
  })

  it('excludes "Mobile Banking payment" transfers by name, regardless of category', () => {
    const result = groupSpendingByPeriod(
      [
        txn({ date: '2026-08-10', amount: 500, category: 'Transfer', name: 'Mobile Banking payment to CRD 1729' }),
        txn({ date: '2026-08-10', amount: 12, category: 'Food and Drink' }),
      ],
      'month',
    )

    expect(result).toEqual([{ label: 'Aug 2026', total: 12 }])
  })
})

describe('totalIncome', () => {
  it('sums credits in the latest period only', () => {
    const result = totalIncome(
      [
        txn({ id: 'aug-paycheck', date: '2026-08-15', amount: -2000, category: 'Payroll' }),
        txn({ id: 'aug-spend', date: '2026-08-16', amount: 50, category: 'Food and Drink' }),
        txn({ id: 'jul-paycheck', date: '2026-07-15', amount: -2000, category: 'Payroll' }),
      ],
      'month',
    )

    expect(result).toBe(2000)
  })

  it('excludes the credit card\'s own mirror entry for a checking-to-card transfer ("PAYMENT FROM CHK ...")', () => {
    const result = totalIncome(
      [
        txn({
          id: 'card-payment-received',
          date: '2026-08-15',
          amount: -500,
          category: 'Payment',
          name: 'PAYMENT FROM CHK 6656 CONF#z71g6b9b2',
        }),
        txn({ id: 'paycheck', date: '2026-08-16', amount: -2000, category: 'Payroll' }),
      ],
      'month',
    )

    expect(result).toBe(2000)
  })

  it('returns 0 when there are no credits in the latest period', () => {
    const result = totalIncome([txn({ date: '2026-08-15', amount: 50, category: 'Food and Drink' })], 'month')

    expect(result).toBe(0)
  })
})

describe('totalSpending', () => {
  it('sums spend in the latest period only', () => {
    const result = totalSpending(
      [
        txn({ id: 'aug-a', date: '2026-08-15', amount: 50, category: 'Food and Drink' }),
        txn({ id: 'aug-b', date: '2026-08-16', amount: 30, category: 'Shops' }),
        txn({ id: 'jul', date: '2026-07-15', amount: 200, category: 'Travel' }),
      ],
      'month',
    )

    expect(result).toBe(80)
  })

  it('excludes credits/refunds', () => {
    const result = totalSpending(
      [txn({ date: '2026-08-15', amount: 50 }), txn({ date: '2026-08-16', amount: -20 })],
      'month',
    )

    expect(result).toBe(50)
  })

  it('excludes checking-to-card transfers by name, regardless of category', () => {
    const result = totalSpending(
      [
        txn({
          date: '2026-08-15',
          amount: 1050.62,
          category: 'Payment',
          name: 'Online Banking payment to CRD 1729 Confirmation# z71g6b9b2',
        }),
        txn({ date: '2026-08-16', amount: 50, category: 'Food and Drink' }),
      ],
      'month',
    )

    expect(result).toBe(50)
  })

  it('returns 0 when there is no spend in the latest period', () => {
    const result = totalSpending([txn({ date: '2026-08-15', amount: -50, category: 'Payroll' })], 'month')

    expect(result).toBe(0)
  })
})

describe('latestPeriodLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-05T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('labels the real calendar today for "day", even when no transaction is dated today', () => {
    const result = latestPeriodLabel(
      [txn({ date: '2026-09-03', amount: 10 }), txn({ date: '2026-09-01', amount: 5 })],
      'day',
    )

    expect(result).toBe('Sep 5')
  })

  it('returns the real calendar today for "day" even with no transactions', () => {
    expect(latestPeriodLabel([], 'day')).toBe('Sep 5')
  })

  it('returns null for no transactions in "month"', () => {
    expect(latestPeriodLabel([], 'month')).toBeNull()
  })
})

describe('filterToLatestPeriod', () => {
  it('keeps only transactions in the most recent month', () => {
    const august = txn({ id: 'aug', date: '2026-08-15', amount: 10 })
    const july = txn({ id: 'jul', date: '2026-07-20', amount: 5 })

    const result = filterToLatestPeriod([july, august], 'month')

    expect(result).toEqual([august])
  })

  it('keeps only transactions in the most recent week (Monday-start)', () => {
    // 2026-08-10 is a Monday; 2026-08-03 is the prior Monday.
    const laterWeek = txn({ id: 'later', date: '2026-08-11', amount: 10 })
    const earlierWeek = txn({ id: 'earlier', date: '2026-08-03', amount: 5 })

    const result = filterToLatestPeriod([earlierWeek, laterWeek], 'week')

    expect(result).toEqual([laterWeek])
  })

  it('includes credits/refunds that fall in the latest period (filtering is by date, not sign)', () => {
    const spend = txn({ id: 'spend', date: '2026-08-15', amount: 10 })
    const refund = txn({ id: 'refund', date: '2026-08-16', amount: -10 })

    const result = filterToLatestPeriod([spend, refund], 'month')

    expect(result).toEqual([spend, refund])
  })

  it('returns an empty array for no transactions', () => {
    expect(filterToLatestPeriod([], 'month')).toEqual([])
  })

  it('for "day", keeps only transactions dated the real calendar today, not the latest date with data', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-05T12:00:00Z'))
    try {
      const today = txn({ id: 'today', date: '2026-09-05', amount: 10 })
      const staleLatest = txn({ id: 'stale', date: '2026-09-03', amount: 5 })

      expect(filterToLatestPeriod([staleLatest, today], 'day')).toEqual([today])
      expect(filterToLatestPeriod([staleLatest], 'day')).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })
})
