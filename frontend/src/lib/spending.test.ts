import { describe, expect, it } from 'vitest'
import { groupSpendingByCategory, groupSpendingByPeriod } from './spending'
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
})
