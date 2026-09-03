import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as financeApi from '../lib/financeApi'
import { FinanceWidget } from './FinanceWidget'

const usePlaidLinkMock = vi.fn()
vi.mock('react-plaid-link', () => ({
  usePlaidLink: (...args: unknown[]) => usePlaidLinkMock(...args),
}))

describe('FinanceWidget', () => {
  beforeEach(() => {
    usePlaidLinkMock.mockReturnValue({ open: vi.fn(), ready: true })
    // The widget always calls fetchLinkToken() on mount whenever it isn't
    // linked yet (the initial state, regardless of what fetchTransactions
    // resolves to), so every test needs this mocked or it fires a real
    // fetch() against the live deployed finance service.
    vi.spyOn(financeApi, 'fetchLinkToken').mockResolvedValue('link-sandbox-fake')
  })

  it('shows a connect button when nothing is linked', async () => {
    vi.spyOn(financeApi, 'fetchTransactions').mockResolvedValue({ linked: false, needsReauth: false, transactions: [] })

    render(<FinanceWidget />)

    expect(await screen.findByText('Connect your bank')).toBeInTheDocument()
  })

  it('renders real transactions once linked', async () => {
    vi.spyOn(financeApi, 'fetchTransactions').mockResolvedValue({
      linked: true,
      needsReauth: false,
      transactions: [
        { id: 't1', date: '2026-09-01', name: 'Coffee Shop', amount: 4.5, category: 'Food and Drink', pending: false },
      ],
    })

    render(<FinanceWidget />)

    expect(await screen.findByText(/Coffee Shop/)).toBeInTheDocument()
  })

  it('shows a reconnect prompt when Plaid reports the item needs re-auth', async () => {
    vi.spyOn(financeApi, 'fetchTransactions').mockResolvedValue({ linked: true, needsReauth: true, transactions: [] })

    render(<FinanceWidget />)

    expect(await screen.findByText(/Reconnect your bank/)).toBeInTheDocument()
  })

  it('shows an enabled Connect your bank button when the item needs re-auth', async () => {
    vi.spyOn(financeApi, 'fetchTransactions').mockResolvedValue({ linked: true, needsReauth: true, transactions: [] })

    render(<FinanceWidget />)

    const button = await screen.findByText('Connect your bank')
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()
    // A fresh link token must be fetched even though `linked` is already true,
    // otherwise the button would be non-functional despite being rendered.
    expect(financeApi.fetchLinkToken).toHaveBeenCalled()
  })

  it('shows a visible error message when fetching transactions fails', async () => {
    vi.spyOn(financeApi, 'fetchTransactions').mockRejectedValue(new Error('network down'))

    render(<FinanceWidget />)

    expect(await screen.findByText(/Couldn't load transactions/)).toBeInTheDocument()
  })

  it('formats a debit as plain currency and a credit as a signed, distinctly-styled amount', async () => {
    vi.spyOn(financeApi, 'fetchTransactions').mockResolvedValue({
      linked: true,
      needsReauth: false,
      transactions: [
        { id: 't1', date: '2026-08-27', name: 'United Airlines', amount: 500, category: 'Travel', pending: false },
        { id: 't2', date: '2026-08-10', name: 'United Airlines Refund', amount: -500, category: 'Travel', pending: false },
      ],
    })

    render(<FinanceWidget />)

    expect(await screen.findByText('$500.00')).toBeInTheDocument()
    const credit = await screen.findByText('+$500.00')
    expect(credit).toHaveClass('finance-txn__amount--credit')
  })

  it('formats the transaction date as a short month/day label, not the raw ISO string', async () => {
    vi.spyOn(financeApi, 'fetchTransactions').mockResolvedValue({
      linked: true,
      needsReauth: false,
      transactions: [
        { id: 't1', date: '2026-08-27', name: 'United Airlines', amount: 500, category: 'Travel', pending: false },
      ],
    })

    render(<FinanceWidget />)

    expect(await screen.findByText('Aug 27')).toBeInTheDocument()
    expect(screen.queryByText('2026-08-27')).not.toBeInTheDocument()
  })

  it('shows the category and a pending badge when present', async () => {
    vi.spyOn(financeApi, 'fetchTransactions').mockResolvedValue({
      linked: true,
      needsReauth: false,
      transactions: [
        { id: 't1', date: '2026-08-27', name: 'Coffee Shop', amount: 4.5, category: 'Food and Drink', pending: true },
      ],
    })

    render(<FinanceWidget />)

    expect(await screen.findByText('Food and Drink')).toBeInTheDocument()
    expect(await screen.findByText('Pending')).toBeInTheDocument()
  })

  it('omits the pending badge when the transaction has settled', async () => {
    vi.spyOn(financeApi, 'fetchTransactions').mockResolvedValue({
      linked: true,
      needsReauth: false,
      transactions: [
        { id: 't1', date: '2026-08-27', name: 'Coffee Shop', amount: 4.5, category: 'Food and Drink', pending: false },
      ],
    })

    render(<FinanceWidget />)

    await screen.findByText('Coffee Shop')
    expect(screen.queryByText('Pending')).not.toBeInTheDocument()
  })

  it('shows income for the selected period, excluding credit-card-payment transfers', async () => {
    vi.spyOn(financeApi, 'fetchTransactions').mockResolvedValue({
      linked: true,
      needsReauth: false,
      transactions: [
        { id: 't1', date: '2026-08-27', name: 'Paycheck', amount: -2000, category: 'Payroll', pending: false },
        {
          id: 't2',
          date: '2026-08-27',
          name: 'Mobile Banking payment to CRD 1729 Confirmation# zvw4vfdia',
          amount: -500,
          category: 'Payment',
          pending: false,
        },
      ],
    })

    render(<FinanceWidget />)

    expect(await screen.findByText(/Income \(this week\)/)).toBeInTheDocument()
    expect(screen.getByText('$2,000.00')).toBeInTheDocument()
  })

  it('shares one Weekly/Monthly toggle across both charts, defaulting to Weekly', async () => {
    vi.spyOn(financeApi, 'fetchTransactions').mockResolvedValue({
      linked: true,
      needsReauth: false,
      transactions: [
        { id: 't1', date: '2026-08-27', name: 'United Airlines', amount: 500, category: 'Travel', pending: false },
      ],
    })

    render(<FinanceWidget />)

    expect(await screen.findByText('Spending by category (this week)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Weekly' })).toHaveClass('active')
  })

  it('switches both charts to the monthly period when Monthly is clicked', async () => {
    vi.spyOn(financeApi, 'fetchTransactions').mockResolvedValue({
      linked: true,
      needsReauth: false,
      transactions: [
        { id: 't1', date: '2026-08-27', name: 'United Airlines', amount: 500, category: 'Travel', pending: false },
      ],
    })

    render(<FinanceWidget />)
    await screen.findByText('Spending by category (this week)')

    fireEvent.click(screen.getByRole('button', { name: 'Monthly' }))

    expect(await screen.findByText('Spending by category (this month)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Monthly' })).toHaveClass('active')
  })

  it('clears a stale error message once a later fetch succeeds', async () => {
    vi.spyOn(financeApi, 'fetchTransactions')
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({
        linked: true,
        needsReauth: false,
        transactions: [
          { id: 't1', date: '2026-09-01', name: 'Coffee Shop', amount: 4.5, category: 'Food and Drink', pending: false },
        ],
      })
    const exchangeSpy = vi.spyOn(financeApi, 'exchangePublicToken').mockResolvedValue(undefined)

    render(<FinanceWidget />)
    await screen.findByText(/Couldn't load transactions/)

    const lastCall = usePlaidLinkMock.mock.calls[usePlaidLinkMock.mock.calls.length - 1]
    const onSuccess = (lastCall[0] as { onSuccess: (token: string) => void }).onSuccess
    onSuccess('public-sandbox-fake')

    await waitFor(() => expect(exchangeSpy).toHaveBeenCalledWith('public-sandbox-fake'))
    await screen.findByText(/Coffee Shop/)
    expect(screen.queryByText(/Couldn't load transactions/)).not.toBeInTheDocument()
  })

  it('exchanges the public token and reloads transactions on Link success', async () => {
    vi.spyOn(financeApi, 'fetchTransactions')
      .mockResolvedValueOnce({ linked: false, needsReauth: false, transactions: [] })
      .mockResolvedValueOnce({
        linked: true,
        needsReauth: false,
        transactions: [
          { id: 't1', date: '2026-09-01', name: 'Coffee Shop', amount: 4.5, category: 'Food and Drink', pending: false },
        ],
      })
    const exchangeSpy = vi.spyOn(financeApi, 'exchangePublicToken').mockResolvedValue(undefined)

    render(<FinanceWidget />)
    await screen.findByText('Connect your bank')

    const lastCall = usePlaidLinkMock.mock.calls[usePlaidLinkMock.mock.calls.length - 1]
    const onSuccess = (lastCall[0] as { onSuccess: (token: string) => void }).onSuccess
    onSuccess('public-sandbox-fake')

    await waitFor(() => expect(exchangeSpy).toHaveBeenCalledWith('public-sandbox-fake'))
    expect(await screen.findByText(/Coffee Shop/)).toBeInTheDocument()
  })
})
