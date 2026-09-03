import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Transaction } from '../lib/financeApi'
import { SpendingPieChart } from './SpendingPieChart'

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

describe('SpendingPieChart', () => {
  // Recharts' pie sectors/legend/labels are painted via its own internal
  // SVG measurement pipeline, which doesn't run synchronously (or at all)
  // under jsdom — asserting on that rendered text would be testing
  // Recharts, not this component. What's actually ours — the category
  // grouping, sorting, and Other-folding — is covered directly against
  // groupSpendingByCategory in spending.test.ts. Here we only verify the
  // component mounts correctly and gates on real data.
  it('renders the chart heading when there is spend to chart', () => {
    render(<SpendingPieChart transactions={[txn({ category: 'Travel', amount: 500 })]} />)

    expect(screen.getByText('Spending by category')).toBeInTheDocument()
  })

  it('renders nothing when there is no spend to chart', () => {
    const { container } = render(<SpendingPieChart transactions={[]} />)

    expect(container).toBeEmptyDOMElement()
  })
})
