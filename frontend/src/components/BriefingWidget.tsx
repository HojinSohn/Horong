import { useCallback, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { fetchLatestBriefing, type Briefing } from '../lib/briefingApi'

const POLL_INTERVAL_MS = 5 * 60 * 1000

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export function BriefingWidget() {
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const result = await fetchLatestBriefing()
      setBriefing(result)
      setError(null)
    } catch {
      setError("Couldn't load the daily briefing.")
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [load])

  return (
    <div className="briefing-widget">
      <h3>Daily Briefing</h3>
      {error && <p className="briefing-widget__error">{error}</p>}
      {!error && !briefing && <p className="briefing-widget__empty">No briefing yet.</p>}
      {!error && briefing && (() => {
        const createdAt = new Date(briefing.createdAt)
        const formattedTime = Number.isNaN(createdAt.getTime()) ? null : timeFormatter.format(createdAt)
        return (
          <>
            <div className="briefing-widget__text">
              <ReactMarkdown>{briefing.text}</ReactMarkdown>
            </div>
            {formattedTime && <span className="briefing-widget__time">{formattedTime}</span>}
          </>
        )
      })()}
    </div>
  )
}
