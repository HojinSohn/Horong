import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

class NoopWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  send() {}
  close() {}
}

// Always install the no-op polyfill, unconditionally: jsdom provides a real
// WebSocket, so a `WebSocket in globalThis` guard here never fires, leaving
// any component that mounts the real useChatSocket (e.g. App.test.tsx, via
// ChatPanel) to open a real socket at the production VPS URL on every test
// run. Individual tests that need a controllable fake still override this
// per-test with vi.stubGlobal('WebSocket', FakeWebSocket), which takes
// precedence regardless of what's set here.
// @ts-expect-error NoopWebSocket only implements the subset of the WebSocket
// interface this codebase uses.
globalThis.WebSocket = NoopWebSocket
