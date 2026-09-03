import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exchangePublicToken, fetchLinkToken, fetchTransactions } from './financeApi'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('financeApi', () => {
  it('fetchLinkToken posts to /link/token and returns the token', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ link_token: 'link-sandbox-fake' }),
    })

    const token = await fetchLinkToken()

    expect(token).toBe('link-sandbox-fake')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/link/token'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('exchangePublicToken posts the public token as JSON', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({ status: 'linked' }) })

    await exchangePublicToken('public-sandbox-fake')

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/link/exchange'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ public_token: 'public-sandbox-fake' }),
      }),
    )
  })

  it('fetchTransactions maps the response to camelCase', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        linked: true,
        needs_reauth: false,
        transactions: [
          { id: 't1', date: '2026-09-01', name: 'Coffee Shop', amount: 4.5, category: 'Food and Drink', pending: false },
        ],
      }),
    })

    const result = await fetchTransactions()

    expect(result).toEqual({
      linked: true,
      needsReauth: false,
      transactions: [
        { id: 't1', date: '2026-09-01', name: 'Coffee Shop', amount: 4.5, category: 'Food and Drink', pending: false },
      ],
    })
  })

  it('fetchTransactions rejects when the server responds with a non-2xx status', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'boom' }),
    })

    await expect(fetchTransactions()).rejects.toThrow('finance API request failed: 500')
  })
})
