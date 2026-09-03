import { useState, type FormEvent } from 'react'
import { useChatSocket, type ConnectionState } from '../hooks/useChatSocket'

interface ChatPanelProps {
  wsUrl: string
}

function statusText(connectionState: ConnectionState) {
  if (connectionState === 'open') return 'Connected'
  if (connectionState === 'closed') return 'Disconnected — reload the page to reconnect'
  return 'Connecting…'
}

export function ChatPanel({ wsUrl }: ChatPanelProps) {
  const { messages, connectionState, pending, sendPrompt } = useChatSocket(wsUrl)
  const [draft, setDraft] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim()) return
    sendPrompt(draft)
    setDraft('')
  }

  return (
    <div className="chat-panel">
      <div className="chat-status">{statusText(connectionState)}</div>
      <ul className="chat-messages">
        {messages.map((message, index) => (
          <li key={index} className={`chat-message chat-message--${message.role}`}>
            {message.text}
          </li>
        ))}
        {pending && <li className="chat-message chat-message--assistant chat-message--pending">Horong is thinking…</li>}
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
