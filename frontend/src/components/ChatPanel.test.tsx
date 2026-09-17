import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as chatSocket from '../hooks/useChatSocket'
import * as briefingApi from '../lib/briefingApi'
import * as openrouterApi from '../lib/openrouterApi'
import { ChatPanel } from './ChatPanel'

function mockChatSocket(overrides: Partial<ReturnType<typeof chatSocket.useChatSocket>> = {}) {
  vi.spyOn(chatSocket, 'useChatSocket').mockReturnValue({
    messages: [],
    connectionState: 'open',
    pending: false,
    sendPrompt: vi.fn(),
    cancel: vi.fn(),
    sessions: [],
    newSession: vi.fn(),
    listSessions: vi.fn(),
    switchSession: vi.fn(),
    ...overrides,
  })
}

describe('ChatPanel', () => {
  beforeEach(() => {
    // ChatPanel renders the OpenRouter usage bar and the Briefing widget
    // independently of chat state; never-resolving keeps them harmlessly
    // blank for tests that don't care about either.
    vi.spyOn(openrouterApi, 'fetchOpenRouterUsage').mockReturnValue(new Promise(() => {}))
    vi.spyOn(openrouterApi, 'fetchCurrentModel').mockReturnValue(new Promise(() => {}))
    vi.spyOn(briefingApi, 'fetchLatestBriefing').mockReturnValue(new Promise(() => {}))
  })

  it('renders the Briefing widget', () => {
    mockChatSocket()

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    expect(screen.getByText('Daily Briefing')).toBeInTheDocument()
  })

  it('sends the draft on submit and clears the input', () => {
    const sendPrompt = vi.fn()
    mockChatSocket({ sendPrompt })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    const input = screen.getByPlaceholderText('Message Horong…') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'hi horong' } })
    fireEvent.submit(input.closest('form')!)

    expect(sendPrompt).toHaveBeenCalledWith('hi horong')
    expect(input.value).toBe('')
  })

  it('renders streamed messages by role', () => {
    mockChatSocket({
      messages: [
        { role: 'user', text: 'hi', streaming: false },
        { role: 'assistant', text: 'hello there', streaming: false },
      ],
    })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    expect(screen.getByText('hi')).toBeInTheDocument()
    expect(screen.getByText('hello there')).toBeInTheDocument()
  })

  it('shows "Connecting…" only while never-yet-connected', () => {
    mockChatSocket({ connectionState: 'connecting' })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    expect(screen.getByText('Connecting…')).toBeInTheDocument()
  })

  it('shows a disconnected message once a connection that was open closes', () => {
    mockChatSocket({ connectionState: 'closed' })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    expect(screen.getByText('Disconnected — reload the page to reconnect')).toBeInTheDocument()
  })

  it('shows a thinking affordance while pending and no chunks have arrived yet', () => {
    mockChatSocket({ messages: [{ role: 'user', text: 'hi', streaming: false }], pending: true })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    expect(screen.getByText('Horong is thinking…')).toBeInTheDocument()
  })

  it('shows a Stop button while pending, calls cancel when clicked, and hides once not pending', () => {
    const cancel = vi.fn()
    mockChatSocket({ messages: [{ role: 'user', text: 'hi', streaming: false }], pending: true, cancel })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('does not show a Stop button when not pending', () => {
    mockChatSocket()

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument()
  })

  it('renders a thought entry as a collapsible summary with the full text inside', () => {
    mockChatSocket({ messages: [{ role: 'thought', text: 'thinking about echo', streaming: false }] })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    expect(screen.getByText('Thinking…')).toBeInTheDocument()
    expect(screen.getByText('thinking about echo')).toBeInTheDocument()
  })

  it('renders a tool_call entry as a collapsible summary naming the tool and its status', () => {
    mockChatSocket({
      messages: [{ role: 'tool_call', id: 'tool-1', title: 'echo_lookup', kind: 'fetch', status: 'completed' }],
    })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    expect(screen.getByText('tool: echo_lookup — completed')).toBeInTheDocument()
  })

  it('renders markdown in assistant messages', () => {
    mockChatSocket({
      messages: [{ role: 'assistant', text: 'Reminder: **deposit return** is due.', streaming: false }],
    })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    const strong = screen.getByText('deposit return')
    expect(strong.tagName).toBe('STRONG')
  })

  it('renders a markdown table in assistant messages', () => {
    mockChatSocket({
      messages: [
        {
          role: 'assistant',
          text: '| Field | Value |\n| --- | --- |\n| Schedule | 09:00 UTC |',
          streaming: false,
        },
      ],
    })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Schedule')).toBeInTheDocument()
  })

  it('renders user messages as plain text, not markdown', () => {
    mockChatSocket({ messages: [{ role: 'user', text: 'is **this** bold?', streaming: false }] })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    expect(screen.getByText('is **this** bold?')).toBeInTheDocument()
  })

  it('renders a visible error message when a send is dropped while not connected', () => {
    mockChatSocket({
      messages: [
        { role: 'user', text: 'hi', streaming: false },
        { role: 'assistant', text: "Error: message wasn't sent — not connected to Horong.", streaming: false },
      ],
      connectionState: 'closed',
    })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    expect(screen.getByText(/wasn't sent/)).toBeInTheDocument()
  })

  it('renders the OpenRouter usage bar in the footer row, not the header', () => {
    mockChatSocket()

    const { container } = render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    const footerRow = container.querySelector('.chat-footer-row')
    expect(footerRow?.querySelector('.openrouter-bar')).not.toBeNull()
    expect(container.querySelector('.chat-header .openrouter-bar')).toBeNull()
  })

  it('calls newSession and clicking "New chat"', () => {
    const newSession = vi.fn()
    mockChatSocket({ newSession })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))
    expect(newSession).toHaveBeenCalledTimes(1)
  })

  it('opens the history panel, requests the session list, and lists entries by title', () => {
    const listSessions = vi.fn()
    mockChatSocket({
      listSessions,
      sessions: [
        { id: 'a', title: 'Fix Notion updates', updatedAt: '2026-09-17T16:34:27.902Z' },
        { id: 'b', title: null, updatedAt: null },
      ],
    })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    fireEvent.click(screen.getByRole('button', { name: 'History' }))

    expect(listSessions).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Fix Notion updates')).toBeInTheDocument()
    // A session with no title still renders as a pickable entry, not blank.
    expect(screen.getByText('Untitled session')).toBeInTheDocument()
  })

  it('switches to the clicked session and closes the history panel', () => {
    const switchSession = vi.fn()
    mockChatSocket({
      switchSession,
      sessions: [{ id: 'a', title: 'Fix Notion updates', updatedAt: '2026-09-17T16:34:27.902Z' }],
    })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    fireEvent.click(screen.getByText('Fix Notion updates'))

    expect(switchSession).toHaveBeenCalledWith('a')
    expect(screen.queryByText('Fix Notion updates')).not.toBeInTheDocument()
  })
})
