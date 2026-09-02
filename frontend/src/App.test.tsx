import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
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
})
