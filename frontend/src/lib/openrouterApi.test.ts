import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCurrentModel } from './openrouterApi'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchCurrentModel', () => {
  it('returns the current model and provider', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ model: 'deepseek/deepseek-v4.1-flash', provider: 'openrouter' }),
    })

    const result = await fetchCurrentModel()

    expect(result).toEqual({ model: 'deepseek/deepseek-v4.1-flash', provider: 'openrouter' })
  })

  it('throws when the response is not ok', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 502, json: async () => ({}) })

    await expect(fetchCurrentModel()).rejects.toThrow('openrouter status API request failed: 502')
  })
})
