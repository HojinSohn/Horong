import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatSocket } from './useChatSocket'

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  sent: string[] = []

  constructor(public url: string) {
    FakeWebSocket.instances.push(this)
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
})
