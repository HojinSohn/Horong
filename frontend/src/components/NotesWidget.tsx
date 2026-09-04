import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { addNote, deleteNote, fetchNotes, updateNote, type Note } from '../lib/notesApi'

interface NotesWidgetProps {
  refreshKey: number
}

export function NotesWidget({ refreshKey }: NotesWidgetProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const cancelledEditRef = useRef(false)

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

  const handleDelete = async (id: number) => {
    try {
      await deleteNote(id)
      await loadNotes()
    } catch {
      setError("Couldn't delete note.")
    }
  }

  const startEdit = (note: Note) => {
    setEditingId(note.id)
    setEditDraft(note.text)
  }

  const saveEdit = async () => {
    if (editingId === null) return
    const id = editingId
    const text = editDraft
    setEditingId(null)
    if (!text.trim()) return
    try {
      await updateNote(id, text)
      await loadNotes()
    } catch {
      setError("Couldn't update note.")
    }
  }

  const handleEditKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur()
    } else if (event.key === 'Escape') {
      cancelledEditRef.current = true
      setEditingId(null)
    }
  }

  const handleEditBlur = () => {
    if (cancelledEditRef.current) {
      cancelledEditRef.current = false
      return
    }
    saveEdit()
  }

  return (
    <div className="widget-card">
      <h2>Notes</h2>
      {error && <p className="notes-error">{error}</p>}
      <ul>
        {notes.map((note) => (
          <li key={note.id} className="notes-item">
            {editingId === note.id ? (
              <input
                className="notes-edit-input"
                value={editDraft}
                onChange={(event) => setEditDraft(event.target.value)}
                onKeyDown={handleEditKeyDown}
                onBlur={handleEditBlur}
                autoFocus
              />
            ) : (
              <span className="notes-item__text" onClick={() => startEdit(note)}>
                {note.text}
              </span>
            )}
            <button
              type="button"
              className="notes-item__delete"
              aria-label={`Delete note: ${note.text}`}
              onClick={() => handleDelete(note.id)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <form className="notes-form" onSubmit={submit}>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add a note…" />
        <button type="submit">Add</button>
      </form>
    </div>
  )
}
