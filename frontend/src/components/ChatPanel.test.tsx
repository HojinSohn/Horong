import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as chatSocket from '../hooks/useChatSocket'
import { ChatPanel } from './ChatPanel'

describe('ChatPanel', () => {
  it('sends the draft on submit and clears the input', () => {
    const sendPrompt = vi.fn()
    vi.spyOn(chatSocket, 'useChatSocket').mockReturnValue({
      messages: [],
      connected: true,
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
      connected: true,
      sendPrompt: vi.fn(),
    })

    render(<ChatPanel wsUrl="ws://bridge.test/ws" />)
    expect(screen.getByText('hi')).toBeInTheDocument()
    expect(screen.getByText('hello there')).toBeInTheDocument()
  })
})
