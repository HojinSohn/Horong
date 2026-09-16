import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { addNote, deleteNote, fetchNotes, updateNote, type Note } from '../lib/notesApi'

interface NotesWidgetProps {
  refreshKey: number
}

export function NotesWidget({ refreshKey }: NotesWidgetProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [viewingNote, setViewingNote] = useState<Note | null>(null)
  const [overlayDraft, setOverlayDraft] = useState('')

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

  const openNote = (note: Note) => {
    setViewingNote(note)
    setOverlayDraft(note.text)
  }

  const closeOverlay = () => setViewingNote(null)

  const saveOverlay = async () => {
    if (!viewingNote) return
    const id = viewingNote.id
    const text = overlayDraft
    setViewingNote(null)
    if (!text.trim()) return
    try {
      await updateNote(id, text)
      await loadNotes()
    } catch {
      setError("Couldn't update note.")
    }
  }

  const deleteFromOverlay = async () => {
    if (!viewingNote) return
    const id = viewingNote.id
    setViewingNote(null)
    try {
      await deleteNote(id)
      await loadNotes()
    } catch {
      setError("Couldn't delete note.")
    }
  }

  return (
    <div className="widget-card notes-widget">
      <h2>Notes</h2>
      {error && <p className="notes-error">{error}</p>}
      <ul>
        {notes.map((note) => (
          <li key={note.id} className="notes-item">
            <span className="notes-item__text" onClick={() => openNote(note)}>
              {note.text}
            </span>
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
      {viewingNote && (
        <div className="note-overlay-backdrop" onClick={closeOverlay}>
          <div className="note-overlay" onClick={(event) => event.stopPropagation()}>
            <textarea
              className="note-overlay__textarea"
              value={overlayDraft}
              onChange={(event) => setOverlayDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') closeOverlay()
              }}
              autoFocus
            />
            <div className="note-overlay__actions">
              <button type="button" className="note-overlay__delete" onClick={deleteFromOverlay}>
                Delete
              </button>
              <div className="note-overlay__actions-right">
                <button type="button" className="note-overlay__cancel" onClick={closeOverlay}>
                  Cancel
                </button>
                <button type="button" className="note-overlay__save" onClick={saveOverlay}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
