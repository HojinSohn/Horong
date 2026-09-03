import { render, screen, waitFor } from '@testing-library/react'
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
  })

  it('shows a connect button when nothing is linked', async () => {
    vi.spyOn(financeApi, 'fetchTransactions').mockResolvedValue({ linked: false, needsReauth: false, transactions: [] })
    vi.spyOn(financeApi, 'fetchLinkToken').mockResolvedValue('link-sandbox-fake')

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
    vi.spyOn(financeApi, 'fetchLinkToken').mockResolvedValue('link-sandbox-fake')
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
