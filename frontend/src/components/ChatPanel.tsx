import { useState, type FormEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useChatSocket, type ConnectionState } from '../hooks/useChatSocket'
import { BriefingWidget } from './BriefingWidget'
import MalteseAvatar from './MalteseAvatar'
import { OpenRouterUsageBar } from './OpenRouterUsageBar'

interface ChatPanelProps {
  wsUrl: string
  onTurnComplete?: () => void
}

function statusText(connectionState: ConnectionState) {
  if (connectionState === 'open') return 'Connected'
  if (connectionState === 'closed') return 'Disconnected — reload the page to reconnect'
  return 'Connecting…'
}

export function ChatPanel({ wsUrl, onTurnComplete }: ChatPanelProps) {
  const { messages, connectionState, pending, sendPrompt, cancel } = useChatSocket(wsUrl, onTurnComplete)
  const [draft, setDraft] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim()) return
    sendPrompt(draft)
    setDraft('')
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-avatar-hero">
          <div className="chat-avatar-ring">
            <MalteseAvatar size={120} />
          </div>
          <span className="chat-status">{statusText(connectionState)}</span>
        </div>
        <BriefingWidget />
      </div>
      <ul className="chat-messages">
        {messages.map((message, index) => {
          if (message.role === 'tool_call') {
            return (
              <li key={index} className="chat-message chat-message--tool_call">
                <details>
                  <summary>tool: {message.title ?? message.id} — {message.status ?? 'pending'}</summary>
                  <span>id: {message.id}{message.kind ? ` · kind: ${message.kind}` : ''}</span>
                </details>
              </li>
            )
          }
          if (message.role === 'thought') {
            return (
              <li key={index} className="chat-message chat-message--thought">
                <details open={message.streaming}>
                  <summary>Thinking…</summary>
                  <span>{message.text}</span>
                </details>
              </li>
            )
          }
          return (
            <li key={index} className={`chat-message chat-message--${message.role}`}>
              {message.role === 'assistant' ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
              ) : (
                message.text
              )}
            </li>
          )
        })}
        {pending && (
          <li className="chat-message chat-message--assistant chat-message--pending">
            Horong is thinking…
            <button type="button" className="chat-stop" onClick={cancel}>
              Stop
            </button>
          </li>
        )}
      </ul>
      <div className="chat-footer-row">
        <OpenRouterUsageBar />
      </div>
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
