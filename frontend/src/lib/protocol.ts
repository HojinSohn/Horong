export type ClientToBridge = { type: 'prompt'; text: string }

export type BridgeToClient =
  | { type: 'chunk'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string }
