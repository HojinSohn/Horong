import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatSocket } from './useChatSocket'

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  sent: string[] = []
  readyState: number
  url: string

  constructor(url: string, initialReadyState = FakeWebSocket.OPEN) {
    this.url = url
    FakeWebSocket.instances.push(this)
    this.readyState = initialReadyState
    if (initialReadyState === FakeWebSocket.OPEN) {
      // Simulate asynchronous connection callback
      queueMicrotask(() => {
        this.onopen?.()
      })
    }
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.onclose?.()
  }

  emitMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }
}

beforeEach(() => {
  FakeWebSocket.instances = []
  vi.stubGlobal('WebSocket', FakeWebSocket)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useChatSocket', () => {
  it('sends a prompt frame and accumulates streamed chunks into one assistant message', () => {
    const { result } = renderHook(() => useChatSocket('ws://bridge.test/ws'))
    const socket = FakeWebSocket.instances[0]

    act(() => {
      result.current.sendPrompt('hello')
    })
    expect(socket.sent).toEqual([JSON.stringify({ type: 'prompt', text: 'hello' })])
    expect(result.current.messages).toEqual([{ role: 'user', text: 'hello', streaming: false }])

    act(() => {
      socket.emitMessage({ type: 'chunk', text: 'Hi ' })
      socket.emitMessage({ type: 'chunk', text: 'there' })
      socket.emitMessage({ type: 'done' })
    })

    expect(result.current.messages).toEqual([
      { role: 'user', text: 'hello', streaming: false },
      { role: 'assistant', text: 'Hi there', streaming: false },
    ])
  })

  it('renders a bridge error as a terminal assistant message', () => {
    const { result } = renderHook(() => useChatSocket('ws://bridge.test/ws'))
    const socket = FakeWebSocket.instances[0]

    act(() => {
      socket.emitMessage({ type: 'error', message: 'agent crashed' })
    })

    expect(result.current.messages).toEqual([
      { role: 'assistant', text: 'Error: agent crashed', streaming: false },
    ])
  })

  it('finalizes in-flight streaming message when error arrives mid-stream', () => {
    const { result } = renderHook(() => useChatSocket('ws://bridge.test/ws'))
    const socket = FakeWebSocket.instances[0]

    act(() => {
      result.current.sendPrompt('hello')
    })

    act(() => {
      socket.emitMessage({ type: 'chunk', text: 'Part 1' })
      socket.emitMessage({ type: 'chunk', text: ' Part 2' })
      socket.emitMessage({ type: 'error', message: 'connection lost' })
    })

    expect(result.current.messages).toEqual([
      { role: 'user', text: 'hello', streaming: false },
      { role: 'assistant', text: 'Part 1 Part 2', streaming: false },
      { role: 'assistant', text: 'Error: connection lost', streaming: false },
    ])
  })

  it('does not send prompt when socket is not yet open, and shows a visible error', () => {
    // Clear instances to have a clean slate
    FakeWebSocket.instances = []

    // Create the hook - it will create a FakeWebSocket with OPEN state
    const { result } = renderHook(() => useChatSocket('ws://bridge.test/ws'))
    const socket = FakeWebSocket.instances[0]

    // Manually set socket to CONNECTING to simulate not-yet-open state
    socket.readyState = FakeWebSocket.CONNECTING

    // sendPrompt is called while readyState is CONNECTING
    act(() => {
      result.current.sendPrompt('early message')
    })

    // Socket should not have sent anything because readyState was CONNECTING
    expect(socket.sent).toEqual([])
    // The message should still be recorded, plus a visible error saying it
    // wasn't sent (previously it silently vanished).
    expect(result.current.messages).toEqual([
      { role: 'user', text: 'early message', streaming: false },
      { role: 'assistant', text: "Error: message wasn't sent — not connected to Horong.", streaming: false },
    ])
    // Nothing was actually sent, so there's nothing to wait on.
    expect(result.current.pending).toBe(false)
  })

  it('sends prompt after socket opens', () => {
    FakeWebSocket.instances = []
    const { result } = renderHook(() => useChatSocket('ws://bridge.test/ws'))
    const socket = FakeWebSocket.instances[0]

    // Set socket to CONNECTING initially
    socket.readyState = FakeWebSocket.CONNECTING

    // Transition it to OPEN
    act(() => {
      socket.readyState = FakeWebSocket.OPEN
      socket.onopen?.()
    })

    // Now send should work
    act(() => {
      result.current.sendPrompt('hello')
    })

    // The send should succeed because readyState is OPEN
    expect(socket.sent).toEqual([JSON.stringify({ type: 'prompt', text: 'hello' })])
    expect(result.current.messages).toEqual([
      { role: 'user', text: 'hello', streaming: false },
    ])
  })

  it('is pending from sendPrompt until the first chunk arrives', () => {
    const { result } = renderHook(() => useChatSocket('ws://bridge.test/ws'))
    const socket = FakeWebSocket.instances[0]

    expect(result.current.pending).toBe(false)

    act(() => {
      result.current.sendPrompt('hello')
    })
    expect(result.current.pending).toBe(true)

    act(() => {
      socket.emitMessage({ type: 'chunk', text: 'Hi' })
    })
    expect(result.current.pending).toBe(false)
  })

  it('clears pending on a done with zero chunks', () => {
    const { result } = renderHook(() => useChatSocket('ws://bridge.test/ws'))
    const socket = FakeWebSocket.instances[0]

    act(() => {
      result.current.sendPrompt('hello')
    })
    expect(result.current.pending).toBe(true)

    act(() => {
      socket.emitMessage({ type: 'done' })
    })
    expect(result.current.pending).toBe(false)
  })

  it('accumulates streamed thought chunks into one collapsed thought entry', () => {
    const { result } = renderHook(() => useChatSocket('ws://bridge.test/ws'))
    const socket = FakeWebSocket.instances[0]

    act(() => {
      socket.emitMessage({ type: 'thought', text: 'Let me ' })
      socket.emitMessage({ type: 'thought', text: 'check that.' })
    })

    expect(result.current.messages).toEqual([
      { role: 'thought', text: 'Let me check that.', streaming: true },
    ])
  })

  it('upserts a tool_call entry by id, preserving title/kind when a later update omits them', () => {
    const { result } = renderHook(() => useChatSocket('ws://bridge.test/ws'))
    const socket = FakeWebSocket.instances[0]

    act(() => {
      socket.emitMessage({ type: 'tool_call', id: 'tool-1', title: 'echo_lookup', kind: 'fetch', status: 'in_progress' })
    })
    expect(result.current.messages).toEqual([
      { role: 'tool_call', id: 'tool-1', title: 'echo_lookup', kind: 'fetch', status: 'in_progress' },
    ])

    act(() => {
      socket.emitMessage({ type: 'tool_call', id: 'tool-1', title: null, kind: null, status: 'completed' })
    })
    expect(result.current.messages).toEqual([
      { role: 'tool_call', id: 'tool-1', title: 'echo_lookup', kind: 'fetch', status: 'completed' },
    ])
  })

  it('interleaves thought, tool_call, and chunk entries in the real order they arrived', () => {
    const { result } = renderHook(() => useChatSocket('ws://bridge.test/ws'))
    const socket = FakeWebSocket.instances[0]

    act(() => {
      result.current.sendPrompt('what tools do you have?')
    })
    act(() => {
      socket.emitMessage({ type: 'thought', text: 'thinking about echo' })
      socket.emitMessage({ type: 'tool_call', id: 'tool-1', title: 'echo_lookup', kind: 'fetch', status: 'in_progress' })
      socket.emitMessage({ type: 'tool_call', id: 'tool-1', title: null, kind: null, status: 'completed' })
      socket.emitMessage({ type: 'chunk', text: 'echo: hi' })
      socket.emitMessage({ type: 'done' })
    })

    expect(result.current.messages).toEqual([
      { role: 'user', text: 'what tools do you have?', streaming: false },
      { role: 'thought', text: 'thinking about echo', streaming: false },
      { role: 'tool_call', id: 'tool-1', title: 'echo_lookup', kind: 'fetch', status: 'completed' },
      { role: 'assistant', text: 'echo: hi', streaming: false },
    ])
  })

  it('invokes onTurnComplete once per done message', () => {
    const onTurnComplete = vi.fn()
    const { result } = renderHook(() => useChatSocket('ws://bridge.test/ws', onTurnComplete))
    const socket = FakeWebSocket.instances[0]

    act(() => {
      result.current.sendPrompt('hello')
    })
    act(() => {
      socket.emitMessage({ type: 'chunk', text: 'Hi' })
      socket.emitMessage({ type: 'done' })
    })

    expect(onTurnComplete).toHaveBeenCalledTimes(1)
  })

  it('does not error when onTurnComplete is omitted', () => {
    renderHook(() => useChatSocket('ws://bridge.test/ws'))
    const socket = FakeWebSocket.instances[0]

    expect(() => {
      act(() => {
        socket.emitMessage({ type: 'done' })
      })
    }).not.toThrow()
  })

  it('sends a cancel frame', () => {
    const { result } = renderHook(() => useChatSocket('ws://bridge.test/ws'))
    const socket = FakeWebSocket.instances[0]

    act(() => {
      result.current.sendPrompt('hello')
    })
    act(() => {
      result.current.cancel()
    })

    expect(socket.sent).toEqual([
      JSON.stringify({ type: 'prompt', text: 'hello' }),
      JSON.stringify({ type: 'cancel' }),
    ])
  })

  it('clears pending once the done that follows a cancel arrives', () => {
    const { result } = renderHook(() => useChatSocket('ws://bridge.test/ws'))
    const socket = FakeWebSocket.instances[0]

    act(() => {
      result.current.sendPrompt('hello')
    })
    expect(result.current.pending).toBe(true)

    act(() => {
      result.current.cancel()
      socket.emitMessage({ type: 'done' })
    })

    expect(result.current.pending).toBe(false)
  })

  it('reports connectionState as connecting, then open, then closed', () => {
    const { result } = renderHook(() => useChatSocket('ws://bridge.test/ws'))
    const socket = FakeWebSocket.instances[0]

    expect(result.current.connectionState).toBe('connecting')

    act(() => {
      socket.onopen?.()
    })
    expect(result.current.connectionState).toBe('open')

    act(() => {
      socket.close()
    })
    expect(result.current.connectionState).toBe('closed')
  })
})
