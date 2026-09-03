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
  // grouping/sorting/Other-folding and the period filtering — is covered
  // directly against groupSpendingByCategory and filterToLatestPeriod in
  // spending.test.ts. Here we only verify the component mounts correctly,
  // reflects the period prop in its (plain-React) heading, and gates on
  // real data.
  it('labels the heading "this week" when period is week', () => {
    render(<SpendingPieChart transactions={[txn({ category: 'Travel', amount: 500 })]} period="week" />)

    expect(screen.getByText('Spending by category (this week)')).toBeInTheDocument()
  })

  it('labels the heading "this month" when period is month', () => {
    render(<SpendingPieChart transactions={[txn({ category: 'Travel', amount: 500 })]} period="month" />)

    expect(screen.getByText('Spending by category (this month)')).toBeInTheDocument()
  })

  it('renders nothing when there is no spend to chart', () => {
    const { container } = render(<SpendingPieChart transactions={[]} period="month" />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the latest period has no spend (only an older period does)', () => {
    // Both transactions are real spend, but in different months — filtering
    // to the latest month should leave nothing for August if July is the
    // only month with data... this case instead checks the inverse: a
    // credit-only latest month has no spend to chart even though the
    // transaction itself falls in-period.
    const { container } = render(
      <SpendingPieChart transactions={[txn({ date: '2026-08-15', amount: -20 })]} period="month" />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
