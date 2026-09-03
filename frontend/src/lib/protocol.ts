export type ClientToBridge = { type: 'prompt'; text: string }

export type BridgeToClient =
  | { type: 'chunk'; text: string }
  | { type: 'thought'; text: string }
  | { type: 'tool_call'; id: string; title: string | null; kind: string | null; status: string | null }
  | { type: 'done' }
  | { type: 'error'; message: string }
