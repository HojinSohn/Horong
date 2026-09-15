import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as briefingApi from '../lib/briefingApi'
import { BriefingWidget } from './BriefingWidget'

describe('BriefingWidget', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('starts collapsed with a small expand toggle', async () => {
    vi.spyOn(briefingApi, 'fetchLatestBriefing').mockResolvedValue(null)

    const { container } = render(<BriefingWidget />)
    await act(async () => {})

    expect(container.querySelector('.briefing-widget--expanded')).toBeNull()
    expect(screen.getByRole('button', { name: 'Expand daily briefing' })).toBeInTheDocument()
  })

  it('expands to a taller view when the toggle is clicked, and collapses back', async () => {
    vi.spyOn(briefingApi, 'fetchLatestBriefing').mockResolvedValue(null)

    const { container } = render(<BriefingWidget />)
    await act(async () => {})

    fireEvent.click(screen.getByRole('button', { name: 'Expand daily briefing' }))
    expect(container.querySelector('.briefing-widget--expanded')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Collapse daily briefing' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Collapse daily briefing' }))
    expect(container.querySelector('.briefing-widget--expanded')).toBeNull()
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

  it('formats the timestamp with a date, not just a time, so a stale briefing is distinguishable', async () => {
    vi.spyOn(briefingApi, 'fetchLatestBriefing').mockResolvedValue({
      text: 'Today: sunny.',
      createdAt: '2026-09-06T09:00:00Z',
    })

    render(<BriefingWidget />)

    await screen.findByText('sunny.', { exact: false })
    expect(screen.getByText(/Sep 6/)).toBeInTheDocument()
  })

  it('does not crash and omits the timestamp when createdAt is not a valid date', async () => {
    vi.spyOn(briefingApi, 'fetchLatestBriefing').mockResolvedValue({
      text: 'Today: sunny.',
      createdAt: 'not-a-real-date',
    })

    render(<BriefingWidget />)

    await screen.findByText('sunny.', { exact: false })
    expect(document.querySelector('.briefing-widget__time')).toBeNull()
  })
})
