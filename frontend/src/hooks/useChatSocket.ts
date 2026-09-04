import { useCallback, useEffect, useRef, useState } from 'react'
import type { BridgeToClient } from '../lib/protocol'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'thought'
  text: string
  streaming: boolean
}

export interface ToolCallEntry {
  role: 'tool_call'
  id: string
  title: string | null
  kind: string | null
  status: string | null
}

export type TranscriptEntry = ChatMessage | ToolCallEntry

export type ConnectionState = 'connecting' | 'open' | 'closed'

function finalizeStreaming(entries: TranscriptEntry[]): TranscriptEntry[] {
  const last = entries[entries.length - 1]
  if (last && 'streaming' in last && last.streaming) {
    return [...entries.slice(0, -1), { ...last, streaming: false }]
  }
  return entries
}

function appendOrAccumulateText(
  entries: TranscriptEntry[],
  role: 'assistant' | 'thought',
  text: string,
): TranscriptEntry[] {
  const last = entries[entries.length - 1]
  if (last?.role === role && 'streaming' in last && last.streaming) {
    return [...entries.slice(0, -1), { ...last, text: last.text + text }]
  }
  // Starting a genuinely new entry supersedes whatever was still streaming
  // (e.g. a tool call arriving mid-thought finalizes that thought).
  return [...finalizeStreaming(entries), { role, text, streaming: true }]
}

function upsertToolCall(
  entries: TranscriptEntry[],
  update: { id: string; title: string | null; kind: string | null; status: string | null },
): TranscriptEntry[] {
  const existing = entries.some((entry) => entry.role === 'tool_call' && entry.id === update.id)
  if (!existing) {
    return [
      ...finalizeStreaming(entries),
      { role: 'tool_call', id: update.id, title: update.title, kind: update.kind, status: update.status },
    ]
  }
  return entries.map((entry) =>
    entry.role === 'tool_call' && entry.id === update.id
      ? {
          ...entry,
          title: update.title ?? entry.title,
          kind: update.kind ?? entry.kind,
          status: update.status ?? entry.status,
        }
      : entry,
  )
}

export function useChatSocket(url: string, onTurnComplete?: () => void) {
  const [messages, setMessages] = useState<TranscriptEntry[]>([])
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const [pending, setPending] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)
  const onTurnCompleteRef = useRef(onTurnComplete)
  onTurnCompleteRef.current = onTurnComplete

  useEffect(() => {
    const socket = new WebSocket(url)
    socketRef.current = socket
    socket.onopen = () => setConnectionState('open')
    socket.onclose = () => setConnectionState('closed')
    socket.onmessage = (event) => {
      const data: BridgeToClient = JSON.parse(event.data)
      // A reply of any kind ends the "waiting for the first chunk" window.
      setPending(false)
      setMessages((prev) => {
        if (data.type === 'chunk') {
          return appendOrAccumulateText(prev, 'assistant', data.text)
        }
        if (data.type === 'thought') {
          return appendOrAccumulateText(prev, 'thought', data.text)
        }
        if (data.type === 'tool_call') {
          return upsertToolCall(prev, data)
        }
        if (data.type === 'done') {
          return finalizeStreaming(prev)
        }
        // data.type === 'error'
        return [...finalizeStreaming(prev), { role: 'assistant', text: `Error: ${data.message}`, streaming: false }]
      })
      if (data.type === 'done') {
        onTurnCompleteRef.current?.()
      }
    }
    return () => socket.close()
  }, [url])

  const sendPrompt = useCallback((text: string) => {
    setMessages((prev) => [...prev, { role: 'user', text, streaming: false }])
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'prompt', text }))
      setPending(true)
    } else {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: "Error: message wasn't sent — not connected to Horong.", streaming: false },
      ])
    }
  }, [])

  return { messages, connectionState, pending, sendPrompt }
}
