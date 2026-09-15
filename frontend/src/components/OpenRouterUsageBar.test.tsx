import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as openrouterApi from '../lib/openrouterApi'
import { OpenRouterUsageBar } from './OpenRouterUsageBar'

describe('OpenRouterUsageBar', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(openrouterApi, 'fetchCurrentModel').mockReturnValue(new Promise(() => {}))
  })

  it('shows remaining balance and weekly usage', async () => {
    vi.spyOn(openrouterApi, 'fetchOpenRouterUsage').mockResolvedValue({
      limitRemaining: 29.37,
      usage: 10.32,
      usageDaily: 0.13,
      usageWeekly: 0.86,
      usageMonthly: 0.63,
      isFreeTier: false,
    })

    render(<OpenRouterUsageBar />)

    expect(await screen.findByText(/\$29\.37 remaining/)).toBeInTheDocument()
    expect(screen.getByText(/\$0\.86 used this week/)).toBeInTheDocument()
  })

  it('omits the remaining-balance figure when limit_remaining is null (unlimited/pay-as-you-go)', async () => {
    vi.spyOn(openrouterApi, 'fetchOpenRouterUsage').mockResolvedValue({
      limitRemaining: null,
      usage: 10.32,
      usageDaily: 0.13,
      usageWeekly: 0.86,
      usageMonthly: 0.63,
      isFreeTier: false,
    })

    render(<OpenRouterUsageBar />)

    expect(await screen.findByText(/\$0\.86 used this week/)).toBeInTheDocument()
    expect(screen.queryByText(/remaining/)).not.toBeInTheDocument()
  })

  it('shows a visible error when the usage fetch fails', async () => {
    vi.spyOn(openrouterApi, 'fetchOpenRouterUsage').mockRejectedValue(new Error('network down'))

    render(<OpenRouterUsageBar />)

    expect(await screen.findByText(/Couldn't load OpenRouter usage/)).toBeInTheDocument()
  })

  it('shows the label and refresh button before the fetch resolves', () => {
    vi.spyOn(openrouterApi, 'fetchOpenRouterUsage').mockReturnValue(new Promise(() => {}))

    render(<OpenRouterUsageBar />)

    expect(screen.getByText('OpenRouter')).toBeInTheDocument()
    expect(screen.getByLabelText('Refresh OpenRouter usage')).toBeInTheDocument()
  })

  it('refetches when the refresh button is clicked', async () => {
    const fetchSpy = vi
      .spyOn(openrouterApi, 'fetchOpenRouterUsage')
      .mockResolvedValueOnce({
        limitRemaining: 29.37,
        usage: 10.32,
        usageDaily: 0.13,
        usageWeekly: 0.86,
        usageMonthly: 0.63,
        isFreeTier: false,
      })
      .mockResolvedValueOnce({
        limitRemaining: 28.5,
        usage: 11.19,
        usageDaily: 0.15,
        usageWeekly: 1.73,
        usageMonthly: 1.5,
        isFreeTier: false,
      })

    render(<OpenRouterUsageBar />)
    await screen.findByText(/\$29\.37 remaining/)

    fireEvent.click(screen.getByLabelText('Refresh OpenRouter usage'))

    expect(await screen.findByText(/\$28\.50 remaining/)).toBeInTheDocument()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('shows the current model once loaded', async () => {
    vi.spyOn(openrouterApi, 'fetchOpenRouterUsage').mockReturnValue(new Promise(() => {}))
    vi.spyOn(openrouterApi, 'fetchCurrentModel').mockResolvedValue({
      model: 'deepseek/deepseek-v4.1-flash',
      provider: 'openrouter',
    })

    render(<OpenRouterUsageBar />)

    expect(await screen.findByText('deepseek/deepseek-v4.1-flash')).toBeInTheDocument()
  })

  it('silently omits the model label when the model fetch fails', async () => {
    vi.spyOn(openrouterApi, 'fetchOpenRouterUsage').mockReturnValue(new Promise(() => {}))
    vi.spyOn(openrouterApi, 'fetchCurrentModel').mockRejectedValue(new Error('network down'))

    render(<OpenRouterUsageBar />)
    await screen.findByText('OpenRouter')

    expect(screen.queryByText(/deepseek/)).not.toBeInTheDocument()
  })
})
