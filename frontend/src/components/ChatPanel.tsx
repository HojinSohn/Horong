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

function formatSessionDate(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function ChatPanel({ wsUrl, onTurnComplete }: ChatPanelProps) {
  const { messages, connectionState, pending, sendPrompt, cancel, sessions, newSession, listSessions, switchSession } =
    useChatSocket(wsUrl, onTurnComplete)
  const [draft, setDraft] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim()) return
    sendPrompt(draft)
    setDraft('')
  }

  const openHistory = () => {
    setHistoryOpen(true)
    listSessions()
  }

  const pickSession = (sessionId: string) => {
    switchSession(sessionId)
    setHistoryOpen(false)
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-avatar-hero">
          <div className="chat-avatar-ring">
            <MalteseAvatar size={120} />
          </div>
          <span className="chat-status">{statusText(connectionState)}</span>
          <div className="chat-header__actions">
            <button type="button" className="portfolio-link" onClick={newSession}>
              New chat
            </button>
            <button type="button" className="portfolio-link" onClick={openHistory}>
              History
            </button>
          </div>
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
      {historyOpen && (
        <div className="note-overlay-backdrop" onClick={() => setHistoryOpen(false)}>
          <div className="note-overlay" onClick={(event) => event.stopPropagation()}>
            <h3 className="history-overlay__title">Past sessions</h3>
            <ul className="history-overlay__list">
              {sessions.length === 0 && <li className="history-overlay__empty">No sessions yet.</li>}
              {sessions.map((session) => (
                <li key={session.id}>
                  <button type="button" className="history-overlay__item" onClick={() => pickSession(session.id)}>
                    <span className="history-overlay__item-title">{session.title ?? 'Untitled session'}</span>
                    {session.updatedAt && (
                      <span className="history-overlay__item-date">{formatSessionDate(session.updatedAt)}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="note-overlay__cancel" onClick={() => setHistoryOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
