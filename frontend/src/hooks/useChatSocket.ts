import { useCallback, useEffect, useRef, useState } from 'react'
import type { BridgeToClient } from '../lib/protocol'

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  streaming: boolean
}

export type ConnectionState = 'connecting' | 'open' | 'closed'

export function useChatSocket(url: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const [pending, setPending] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)

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
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant' && last.streaming) {
            return [...prev.slice(0, -1), { ...last, text: last.text + data.text }]
          }
          return [...prev, { role: 'assistant', text: data.text, streaming: true }]
        }
        if (data.type === 'done') {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant' && last.streaming) {
            return [...prev.slice(0, -1), { ...last, streaming: false }]
          }
          return prev
        }
        // data.type === 'error'
        // First, finalize any in-flight streaming message
        let result = prev
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant' && last.streaming) {
          result = [...prev.slice(0, -1), { ...last, streaming: false }]
        }
        // Then append the error message
        return [...result, { role: 'assistant', text: `Error: ${data.message}`, streaming: false }]
      })
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
