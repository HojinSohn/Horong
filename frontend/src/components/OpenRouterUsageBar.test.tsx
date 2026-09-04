import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as openrouterApi from '../lib/openrouterApi'
import { OpenRouterUsageBar } from './OpenRouterUsageBar'

describe('OpenRouterUsageBar', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
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

  it('renders nothing before the fetch resolves', () => {
    vi.spyOn(openrouterApi, 'fetchOpenRouterUsage').mockReturnValue(new Promise(() => {}))

    const { container } = render(<OpenRouterUsageBar />)

    expect(container.textContent).toBe('')
  })
})
