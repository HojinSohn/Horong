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

  constructor(public url: string, initialReadyState = FakeWebSocket.OPEN) {
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

  it('does not send prompt when socket is not yet open', () => {
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
    // But the message should still be recorded in the UI
    expect(result.current.messages).toEqual([
      { role: 'user', text: 'early message', streaming: false },
    ])
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
})
