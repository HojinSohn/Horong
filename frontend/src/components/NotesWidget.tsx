import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { addNote, fetchNotes, type Note } from '../lib/notesApi'

interface NotesWidgetProps {
  refreshKey: number
}

export function NotesWidget({ refreshKey }: NotesWidgetProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const loadNotes = useCallback(async () => {
    try {
      const result = await fetchNotes()
      setNotes(result)
      setError(null)
    } catch {
      setError("Couldn't load notes.")
    }
  }, [])

  useEffect(() => {
    loadNotes()
  }, [loadNotes, refreshKey])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim()) return
    try {
      await addNote(draft)
      setDraft('')
      await loadNotes()
    } catch {
      setError("Couldn't add note.")
    }
  }

  return (
    <div className="widget-card">
      <h2>Notes</h2>
      {error && <p className="notes-error">{error}</p>}
      <ul>
        {notes.map((note) => (
          <li key={note.id}>{note.text}</li>
        ))}
      </ul>
      <form className="notes-form" onSubmit={submit}>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add a note…" />
        <button type="submit">Add</button>
      </form>
    </div>
  )
}
