import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as notesApi from '../lib/notesApi'
import { NotesWidget } from './NotesWidget'

describe('NotesWidget', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(notesApi, 'fetchNotes').mockResolvedValue([])
    vi.spyOn(notesApi, 'addNote').mockResolvedValue(undefined)
    vi.spyOn(notesApi, 'updateNote').mockResolvedValue(undefined)
    vi.spyOn(notesApi, 'deleteNote').mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches and renders notes on mount', async () => {
    vi.spyOn(notesApi, 'fetchNotes').mockResolvedValue([
      { id: 2, text: 'second note', createdAt: '2026-09-03T00:00:00Z' },
      { id: 1, text: 'first note', createdAt: '2026-09-02T00:00:00Z' },
    ])

    render(<NotesWidget refreshKey={0} />)

    expect(await screen.findByText('second note')).toBeInTheDocument()
    expect(screen.getByText('first note')).toBeInTheDocument()
  })

  it('shows a visible error when notes fail to load', async () => {
    vi.spyOn(notesApi, 'fetchNotes').mockRejectedValue(new Error('network down'))

    render(<NotesWidget refreshKey={0} />)

    expect(await screen.findByText(/Couldn't load notes/)).toBeInTheDocument()
  })

  it('adds a note via the inline form and refetches', async () => {
    const addNoteSpy = vi.spyOn(notesApi, 'addNote').mockResolvedValue(undefined)
    vi.spyOn(notesApi, 'fetchNotes').mockResolvedValueOnce([]).mockResolvedValueOnce([
      { id: 1, text: 'typed note', createdAt: '2026-09-03T00:00:00Z' },
    ])

    render(<NotesWidget refreshKey={0} />)
    await screen.findByText('Notes')

    const input = screen.getByPlaceholderText('Add a note…') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'typed note' } })
    fireEvent.submit(input.closest('form')!)

    expect(addNoteSpy).toHaveBeenCalledWith('typed note')
    expect(await screen.findByText('typed note')).toBeInTheDocument()
    expect(input.value).toBe('')
  })

  it('refetches when refreshKey changes', async () => {
    const fetchSpy = vi
      .spyOn(notesApi, 'fetchNotes')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1, text: 'added via chat', createdAt: '2026-09-03T00:00:00Z' }])

    const { rerender } = render(<NotesWidget refreshKey={0} />)
    await screen.findByText('Notes')
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    rerender(<NotesWidget refreshKey={1} />)

    expect(await screen.findByText('added via chat')).toBeInTheDocument()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('deletes a note via the delete button and refetches', async () => {
    const deleteNoteSpy = vi.spyOn(notesApi, 'deleteNote').mockResolvedValue(undefined)
    vi.spyOn(notesApi, 'fetchNotes')
      .mockResolvedValueOnce([{ id: 1, text: 'to remove', createdAt: '2026-09-03T00:00:00Z' }])
      .mockResolvedValueOnce([])

    render(<NotesWidget refreshKey={0} />)
    await screen.findByText('to remove')

    fireEvent.click(screen.getByLabelText('Delete note: to remove'))

    expect(deleteNoteSpy).toHaveBeenCalledWith(1)
    await waitFor(() => expect(screen.queryByText('to remove')).not.toBeInTheDocument())
  })

  it('shows a visible error when deleting a note fails', async () => {
    vi.spyOn(notesApi, 'deleteNote').mockRejectedValue(new Error('network down'))
    vi.spyOn(notesApi, 'fetchNotes').mockResolvedValue([{ id: 1, text: 'stuck note', createdAt: '2026-09-03T00:00:00Z' }])

    render(<NotesWidget refreshKey={0} />)
    await screen.findByText('stuck note')

    fireEvent.click(screen.getByLabelText('Delete note: stuck note'))

    expect(await screen.findByText(/Couldn't delete note/)).toBeInTheDocument()
  })

  it('opens an overlay with the full text when a note is clicked', async () => {
    vi.spyOn(notesApi, 'fetchNotes').mockResolvedValue([
      { id: 1, text: 'a long note that would otherwise be truncated', createdAt: '2026-09-03T00:00:00Z' },
    ])

    render(<NotesWidget refreshKey={0} />)
    await screen.findByText('a long note that would otherwise be truncated')

    fireEvent.click(screen.getByText('a long note that would otherwise be truncated'))

    expect(screen.getByDisplayValue('a long note that would otherwise be truncated')).toBeInTheDocument()
  })

  it('edits a note in the overlay and saves', async () => {
    const updateNoteSpy = vi.spyOn(notesApi, 'updateNote').mockResolvedValue(undefined)
    vi.spyOn(notesApi, 'fetchNotes')
      .mockResolvedValueOnce([{ id: 1, text: 'original', createdAt: '2026-09-03T00:00:00Z' }])
      .mockResolvedValueOnce([{ id: 1, text: 'revised', createdAt: '2026-09-03T00:00:00Z' }])

    render(<NotesWidget refreshKey={0} />)
    await screen.findByText('original')

    fireEvent.click(screen.getByText('original'))
    const textarea = screen.getByDisplayValue('original')
    fireEvent.change(textarea, { target: { value: 'revised' } })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => expect(updateNoteSpy).toHaveBeenCalledWith(1, 'revised'))
    expect(await screen.findByText('revised')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('revised')).not.toBeInTheDocument()
  })

  it('deletes a note from the overlay', async () => {
    const deleteNoteSpy = vi.spyOn(notesApi, 'deleteNote').mockResolvedValue(undefined)
    vi.spyOn(notesApi, 'fetchNotes')
      .mockResolvedValueOnce([{ id: 1, text: 'to remove', createdAt: '2026-09-03T00:00:00Z' }])
      .mockResolvedValueOnce([])

    render(<NotesWidget refreshKey={0} />)
    await screen.findByText('to remove')

    fireEvent.click(screen.getByText('to remove'))
    fireEvent.click(screen.getByText('Delete'))

    expect(deleteNoteSpy).toHaveBeenCalledWith(1)
    await waitFor(() => expect(screen.queryByText('to remove')).not.toBeInTheDocument())
  })

  it('cancels the overlay on Escape without saving', async () => {
    const updateNoteSpy = vi.spyOn(notesApi, 'updateNote').mockResolvedValue(undefined)
    vi.spyOn(notesApi, 'fetchNotes').mockResolvedValue([{ id: 1, text: 'original', createdAt: '2026-09-03T00:00:00Z' }])

    render(<NotesWidget refreshKey={0} />)
    await screen.findByText('original')

    fireEvent.click(screen.getByText('original'))
    const textarea = screen.getByDisplayValue('original')
    fireEvent.change(textarea, { target: { value: 'discarded' } })
    fireEvent.keyDown(textarea, { key: 'Escape' })

    expect(updateNoteSpy).not.toHaveBeenCalled()
    expect(screen.queryByDisplayValue('discarded')).not.toBeInTheDocument()
    expect(await screen.findByText('original')).toBeInTheDocument()
  })

  it('cancels the overlay via Cancel button or backdrop click without saving', async () => {
    const updateNoteSpy = vi.spyOn(notesApi, 'updateNote').mockResolvedValue(undefined)
    vi.spyOn(notesApi, 'fetchNotes').mockResolvedValue([{ id: 1, text: 'original', createdAt: '2026-09-03T00:00:00Z' }])

    render(<NotesWidget refreshKey={0} />)
    await screen.findByText('original')

    fireEvent.click(screen.getByText('original'))
    fireEvent.click(screen.getByText('Cancel'))

    expect(updateNoteSpy).not.toHaveBeenCalled()
    expect(screen.queryByDisplayValue('original')).not.toBeInTheDocument()
  })
})
