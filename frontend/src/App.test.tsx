import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as financeApi from './lib/financeApi'
import * as notesApi from './lib/notesApi'

vi.mock('react-plaid-link', () => ({
  usePlaidLink: () => ({ open: vi.fn(), ready: false }),
}))

describe('App', () => {
  beforeEach(() => {
    vi.spyOn(financeApi, 'fetchTransactions').mockResolvedValue({ linked: false, needsReauth: false, transactions: [] })
    vi.spyOn(financeApi, 'fetchLinkToken').mockResolvedValue('link-sandbox-fake')
    vi.spyOn(notesApi, 'fetchNotes').mockResolvedValue([])
  })

  it('renders the three-column layout regions', () => {
    render(<App />)
    expect(screen.getByLabelText('Job tracking and notes')).toBeInTheDocument()
    expect(screen.getByLabelText('Horong chat column')).toBeInTheDocument()
    expect(screen.getByLabelText('Finance and stocks')).toBeInTheDocument()
  })

  it('renders mock widget titles in the side columns', () => {
    render(<App />)
    expect(screen.getByText('Job Tracking')).toBeInTheDocument()
    expect(screen.getByText('Finance')).toBeInTheDocument()
  })

  it('renders the live Notes widget instead of the old mock', async () => {
    render(<App />)
    expect(await screen.findByText('Notes')).toBeInTheDocument()
    expect(screen.queryByText('Follow up with recruiter Friday')).not.toBeInTheDocument()
  })
})
