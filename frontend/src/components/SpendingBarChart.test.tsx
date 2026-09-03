import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Transaction } from '../lib/financeApi'
import { SpendingBarChart } from './SpendingBarChart'

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

describe('SpendingBarChart', () => {
  // As in SpendingPieChart.test.tsx: Recharts' own SVG rendering isn't
  // reliably assertable under jsdom, so we test our own logic (the
  // period toggle's state, and groupSpendingByPeriod directly in
  // spending.test.ts) rather than the library's painted bars.
  it('renders the chart heading and a Weekly/Monthly toggle, defaulting to Weekly', () => {
    render(<SpendingBarChart transactions={[txn({ date: '2026-08-10', amount: 30 })]} />)

    expect(screen.getByText('Spending over time')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Weekly' })).toHaveClass('active')
    expect(screen.getByRole('button', { name: 'Monthly' })).not.toHaveClass('active')
  })

  it('switches the active toggle button when Monthly is clicked', () => {
    render(<SpendingBarChart transactions={[txn({ date: '2026-08-10', amount: 30 })]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Monthly' }))

    expect(screen.getByRole('button', { name: 'Monthly' })).toHaveClass('active')
    expect(screen.getByRole('button', { name: 'Weekly' })).not.toHaveClass('active')
  })

  it('renders nothing when there is no spend to chart', () => {
    const { container } = render(<SpendingBarChart transactions={[]} />)

    expect(container).toBeEmptyDOMElement()
  })
})
