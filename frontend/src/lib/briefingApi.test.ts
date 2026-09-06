import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchLatestBriefing } from './briefingApi'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('briefingApi', () => {
  it('fetchLatestBriefing returns null when nothing has been saved yet', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ briefing: null }),
    })

    const result = await fetchLatestBriefing()

    expect(result).toBeNull()
  })

  it('fetchLatestBriefing returns the briefing text and timestamp', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Today: **sunny**.', created_at: '2026-09-06T09:00:00+00:00' }),
    })

    const result = await fetchLatestBriefing()

    expect(result).toEqual({ text: 'Today: **sunny**.', createdAt: '2026-09-06T09:00:00+00:00' })
  })

  it('throws when the response is not ok', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })

    await expect(fetchLatestBriefing()).rejects.toThrow('briefing API request failed: 500')
  })
})
