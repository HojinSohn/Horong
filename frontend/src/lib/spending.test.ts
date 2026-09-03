import { describe, expect, it } from 'vitest'
import { filterToLatestPeriod, groupSpendingByCategory, groupSpendingByPeriod, totalIncome } from './spending'
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

  it('excludes internal credit-card-payment transfers (category "Payment")', () => {
    const result = groupSpendingByCategory([
      txn({ category: 'Payment', amount: 500, name: 'Mobile Banking payment to CREDIT CARD' }),
      txn({ category: 'Food and Drink', amount: 12 }),
    ])

    expect(result).toEqual([{ category: 'Food and Drink', total: 12 }])
  })

  it('excludes "Mobile Banking payment" transfers even when Plaid categorizes them as "Transfer"', () => {
    const result = groupSpendingByCategory([
      txn({
        category: 'Transfer',
        amount: 166.79,
        name: 'Mobile Banking payment to CRD 1729 Confirmation# zvw4vfdia',
      }),
      txn({ category: 'Food and Drink', amount: 12 }),
    ])

    expect(result).toEqual([{ category: 'Food and Drink', total: 12 }])
  })

  it('keeps other "Transfer"-categorized spend that is not a card payment (e.g. a mis-categorized purchase or a Zelle payment)', () => {
    const result = groupSpendingByCategory([
      txn({ category: 'Transfer', amount: 8.5, name: 'ARA PURDUE BOILERMAKER MK' }),
      txn({ category: 'Transfer', amount: 40, name: 'Zelle payment to SUKMIN for "Pott"; Conf# xy880uh0i' }),
    ])

    expect(result).toEqual([{ category: 'Transfer', total: 48.5 }])
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

  it('excludes internal credit-card-payment transfers (category "Payment")', () => {
    const result = groupSpendingByPeriod(
      [
        txn({ date: '2026-08-10', amount: 500, category: 'Payment' }),
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

  it('excludes internal credit-card-payment transfers (category "Payment")', () => {
    const result = totalIncome(
      [
        txn({ id: 'card-payment-received', date: '2026-08-15', amount: -500, category: 'Payment' }),
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
})
