import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as notesApi from '../lib/notesApi'
import { NotesWidget } from './NotesWidget'

describe('NotesWidget', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(notesApi, 'fetchNotes').mockResolvedValue([])
    vi.spyOn(notesApi, 'addNote').mockResolvedValue(undefined)
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
})
