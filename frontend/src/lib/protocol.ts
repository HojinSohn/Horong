export type ClientToBridge =
  | { type: 'prompt'; text: string }
  | { type: 'cancel' }
  | { type: 'new_session' }
  | { type: 'list_sessions' }
  | { type: 'switch_session'; session_id: string }

export interface SessionListEntry {
  id: string
  title: string | null
  updatedAt: string | null
}

export type BridgeToClient =
  | { type: 'chunk'; text: string }
  | { type: 'thought'; text: string }
  | { type: 'user_chunk'; text: string }
  | { type: 'tool_call'; id: string; title: string | null; kind: string | null; status: string | null }
  | { type: 'done' }
  | { type: 'error'; message: string }
  | { type: 'session_list'; sessions: SessionListEntry[] }
