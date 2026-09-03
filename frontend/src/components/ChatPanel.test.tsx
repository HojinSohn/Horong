import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as chatSocket from '../hooks/useChatSocket'
import { ChatPanel } from './ChatPanel'

describe('ChatPanel', () => {
  it('sends the draft on submit and clears the input', () => {
    const sendPrompt = vi.fn()
    vi.spyOn(chatSocket, 'useChatSocket').mockReturnValue({
      messages: [],
      connectionState: 'open',
      pending: false,
      sendPrompt,
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
    })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    expect(screen.getByText('Horong is thinking…')).toBeInTheDocument()
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
    })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    expect(screen.getByText(/wasn't sent/)).toBeInTheDocument()
  })
})
