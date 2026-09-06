import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as briefingApi from '../lib/briefingApi'
import { BriefingWidget } from './BriefingWidget'

describe('BriefingWidget', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('shows an empty state when no briefing has been saved yet', async () => {
    vi.spyOn(briefingApi, 'fetchLatestBriefing').mockResolvedValue(null)

    render(<BriefingWidget />)

    expect(await screen.findByText('No briefing yet.')).toBeInTheDocument()
  })

  it('renders the briefing text as markdown', async () => {
    vi.spyOn(briefingApi, 'fetchLatestBriefing').mockResolvedValue({
      text: 'Today: **sunny**.',
      createdAt: '2026-09-06T09:00:00Z',
    })

    render(<BriefingWidget />)

    const strong = await screen.findByText('sunny')
    expect(strong.tagName).toBe('STRONG')
  })

  it('shows a visible error message when fetching fails', async () => {
    vi.spyOn(briefingApi, 'fetchLatestBriefing').mockRejectedValue(new Error('network down'))

    render(<BriefingWidget />)

    expect(await screen.findByText("Couldn't load the daily briefing.")).toBeInTheDocument()
  })

  it('refetches after the poll interval elapses', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi.spyOn(briefingApi, 'fetchLatestBriefing').mockResolvedValue(null)

    render(<BriefingWidget />)
    await act(async () => {}) // flush the initial mount fetch
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
    })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})
