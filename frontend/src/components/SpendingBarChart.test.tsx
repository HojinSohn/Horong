import { render, screen } from '@testing-library/react'
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
  // reliably assertable under jsdom, so we test our own logic — the period
  // grouping is covered directly against groupSpendingByPeriod in
  // spending.test.ts; the shared Weekly/Monthly toggle now lives in
  // FinanceWidget (tested there), since it's one control that scopes both
  // charts, not a per-chart toggle.
  it('renders the chart heading when there is spend to chart', () => {
    render(<SpendingBarChart transactions={[txn({ date: '2026-08-10', amount: 30 })]} period="week" />)

    expect(screen.getByText('Spending over time')).toBeInTheDocument()
  })

  it('renders nothing when there is no spend to chart', () => {
    const { container } = render(<SpendingBarChart transactions={[]} period="week" />)

    expect(container).toBeEmptyDOMElement()
  })
})
