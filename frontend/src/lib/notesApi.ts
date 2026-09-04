const NOTES_BASE_URL = import.meta.env.VITE_NOTES_BASE_URL ?? 'http://100.109.58.59:8767'

export interface Note {
  id: number
  text: string
  createdAt: string
}

export async function fetchNotes(): Promise<Note[]> {
  const response = await fetch(`${NOTES_BASE_URL}/notes`)
  if (!response.ok) {
    throw new Error(`notes API request failed: ${response.status}`)
  }
  const data = await response.json()
  return data.notes.map((n: { id: number; text: string; created_at: string }) => ({
    id: n.id,
    text: n.text,
    createdAt: n.created_at,
  }))
}

export async function addNote(text: string): Promise<void> {
  const response = await fetch(`${NOTES_BASE_URL}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!response.ok) {
    throw new Error(`notes API request failed: ${response.status}`)
  }
}

export async function updateNote(id: number, text: string): Promise<void> {
  const response = await fetch(`${NOTES_BASE_URL}/notes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!response.ok) {
    throw new Error(`notes API request failed: ${response.status}`)
  }
}

export async function deleteNote(id: number): Promise<void> {
  const response = await fetch(`${NOTES_BASE_URL}/notes/${id}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error(`notes API request failed: ${response.status}`)
  }
}
