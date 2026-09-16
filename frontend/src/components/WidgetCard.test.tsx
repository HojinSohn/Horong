import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WidgetCard } from './WidgetCard'

describe('WidgetCard', () => {
  it('renders a plain line as text, not a link', () => {
    render(<WidgetCard title="Job Tracking" lines={[{ text: 'Acme Corp — applied' }]} />)

    const item = screen.getByText('Acme Corp — applied')
    expect(item.tagName).not.toBe('A')
  })

  it('renders a line with an href as a link that opens in a new tab', () => {
    render(<WidgetCard title="Job Search" lines={[{ text: 'NVIDIA — role', href: 'https://example.com/job' }]} />)

    const link = screen.getByRole('link', { name: 'NVIDIA — role' })
    expect(link).toHaveAttribute('href', 'https://example.com/job')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
