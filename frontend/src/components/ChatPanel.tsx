import { useState, type FormEvent } from 'react'
import { useChatSocket } from '../hooks/useChatSocket'

interface ChatPanelProps {
  wsUrl: string
}

export function ChatPanel({ wsUrl }: ChatPanelProps) {
  const { messages, connected, sendPrompt } = useChatSocket(wsUrl)
  const [draft, setDraft] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim()) return
    sendPrompt(draft)
    setDraft('')
  }

  return (
    <div className="chat-panel">
      <div className="chat-status">{connected ? 'Connected' : 'Connecting…'}</div>
      <ul className="chat-messages">
        {messages.map((message, index) => (
          <li key={index} className={`chat-message chat-message--${message.role}`}>
            {message.text}
          </li>
        ))}
      </ul>
      <form onSubmit={submit}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Message Horong…"
        />
        <button type="submit">Send</button>
      </form>
    </div>
  )
}
