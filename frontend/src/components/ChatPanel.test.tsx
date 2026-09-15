import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as chatSocket from '../hooks/useChatSocket'
import * as briefingApi from '../lib/briefingApi'
import * as openrouterApi from '../lib/openrouterApi'
import { ChatPanel } from './ChatPanel'

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
    vi.spyOn(chatSocket, 'useChatSocket').mockReturnValue({
      messages: [],
      connectionState: 'open',
      pending: false,
      sendPrompt: vi.fn(),
      cancel: vi.fn(),
    })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    expect(screen.getByText('Daily Briefing')).toBeInTheDocument()
  })

  it('sends the draft on submit and clears the input', () => {
    const sendPrompt = vi.fn()
    vi.spyOn(chatSocket, 'useChatSocket').mockReturnValue({
      messages: [],
      connectionState: 'open',
      pending: false,
      sendPrompt,
      cancel: vi.fn(),
    })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    const input = screen.getByPlaceholderText('Message Horong…') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'hi horong' } })
    fireEvent.submit(input.closest('form')!)

    expect(sendPrompt).toHaveBeenCalledWith('hi horong')
    expect(input.value).toBe('')
  })

  it('renders streamed messages by role', () => {
    vi.spyOn(chatSocket, 'useChatSocket').mockReturnValue({
      messages: [
        { role: 'user', text: 'hi', streaming: false },
        { role: 'assistant', text: 'hello there', streaming: false },
      ],
      connectionState: 'open',
      pending: false,
      sendPrompt: vi.fn(),
      cancel: vi.fn(),
    })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    expect(screen.getByText('hi')).toBeInTheDocument()
    expect(screen.getByText('hello there')).toBeInTheDocument()
  })

  it('shows "Connecting…" only while never-yet-connected', () => {
    vi.spyOn(chatSocket, 'useChatSocket').mockReturnValue({
      messages: [],
      connectionState: 'connecting',
      pending: false,
      sendPrompt: vi.fn(),
      cancel: vi.fn(),
    })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    expect(screen.getByText('Connecting…')).toBeInTheDocument()
  })

  it('shows a disconnected message once a connection that was open closes', () => {
    vi.spyOn(chatSocket, 'useChatSocket').mockReturnValue({
      messages: [],
      connectionState: 'closed',
      pending: false,
      sendPrompt: vi.fn(),
      cancel: vi.fn(),
    })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    expect(screen.getByText('Disconnected — reload the page to reconnect')).toBeInTheDocument()
  })

  it('shows a thinking affordance while pending and no chunks have arrived yet', () => {
    vi.spyOn(chatSocket, 'useChatSocket').mockReturnValue({
      messages: [{ role: 'user', text: 'hi', streaming: false }],
      connectionState: 'open',
      pending: true,
      sendPrompt: vi.fn(),
      cancel: vi.fn(),
    })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    expect(screen.getByText('Horong is thinking…')).toBeInTheDocument()
  })

  it('shows a Stop button while pending, calls cancel when clicked, and hides once not pending', () => {
    const cancel = vi.fn()
    vi.spyOn(chatSocket, 'useChatSocket').mockReturnValue({
      messages: [{ role: 'user', text: 'hi', streaming: false }],
      connectionState: 'open',
      pending: true,
      sendPrompt: vi.fn(),
      cancel,
    })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('does not show a Stop button when not pending', () => {
    vi.spyOn(chatSocket, 'useChatSocket').mockReturnValue({
      messages: [],
      connectionState: 'open',
      pending: false,
      sendPrompt: vi.fn(),
      cancel: vi.fn(),
    })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument()
  })

  it('renders a thought entry as a collapsible summary with the full text inside', () => {
    vi.spyOn(chatSocket, 'useChatSocket').mockReturnValue({
      messages: [{ role: 'thought', text: 'thinking about echo', streaming: false }],
      connectionState: 'open',
      pending: false,
      sendPrompt: vi.fn(),
      cancel: vi.fn(),
    })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    expect(screen.getByText('Thinking…')).toBeInTheDocument()
    expect(screen.getByText('thinking about echo')).toBeInTheDocument()
  })

  it('renders a tool_call entry as a collapsible summary naming the tool and its status', () => {
    vi.spyOn(chatSocket, 'useChatSocket').mockReturnValue({
      messages: [{ role: 'tool_call', id: 'tool-1', title: 'echo_lookup', kind: 'fetch', status: 'completed' }],
      connectionState: 'open',
      pending: false,
      sendPrompt: vi.fn(),
      cancel: vi.fn(),
    })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    expect(screen.getByText('tool: echo_lookup — completed')).toBeInTheDocument()
  })

  it('renders markdown in assistant messages', () => {
    vi.spyOn(chatSocket, 'useChatSocket').mockReturnValue({
      messages: [{ role: 'assistant', text: 'Reminder: **deposit return** is due.', streaming: false }],
      connectionState: 'open',
      pending: false,
      sendPrompt: vi.fn(),
      cancel: vi.fn(),
    })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    const strong = screen.getByText('deposit return')
    expect(strong.tagName).toBe('STRONG')
  })

  it('renders a markdown table in assistant messages', () => {
    vi.spyOn(chatSocket, 'useChatSocket').mockReturnValue({
      messages: [
        {
          role: 'assistant',
          text: '| Field | Value |\n| --- | --- |\n| Schedule | 09:00 UTC |',
          streaming: false,
        },
      ],
      connectionState: 'open',
      pending: false,
      sendPrompt: vi.fn(),
      cancel: vi.fn(),
    })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Schedule')).toBeInTheDocument()
  })

  it('renders user messages as plain text, not markdown', () => {
    vi.spyOn(chatSocket, 'useChatSocket').mockReturnValue({
      messages: [{ role: 'user', text: 'is **this** bold?', streaming: false }],
      connectionState: 'open',
      pending: false,
      sendPrompt: vi.fn(),
      cancel: vi.fn(),
    })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    expect(screen.getByText('is **this** bold?')).toBeInTheDocument()
  })

  it('renders a visible error message when a send is dropped while not connected', () => {
    vi.spyOn(chatSocket, 'useChatSocket').mockReturnValue({
      messages: [
        { role: 'user', text: 'hi', streaming: false },
        { role: 'assistant', text: "Error: message wasn't sent — not connected to Horong.", streaming: false },
      ],
      connectionState: 'closed',
      pending: false,
      sendPrompt: vi.fn(),
      cancel: vi.fn(),
    })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    expect(screen.getByText(/wasn't sent/)).toBeInTheDocument()
  })

  it('renders the OpenRouter usage bar in the footer row, not the header', () => {
    vi.spyOn(chatSocket, 'useChatSocket').mockReturnValue({
      messages: [],
      connectionState: 'open',
      pending: false,
      sendPrompt: vi.fn(),
      cancel: vi.fn(),
    })

    const { container } = render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    const footerRow = container.querySelector('.chat-footer-row')
    expect(footerRow?.querySelector('.openrouter-bar')).not.toBeNull()
    expect(container.querySelector('.chat-header .openrouter-bar')).toBeNull()
  })
})
