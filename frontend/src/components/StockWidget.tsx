import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { addTicker, deleteTicker, fetchQuotes, fetchTickers, type Quote } from '../lib/stocksApi'

const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: 'always',
})

export function StockWidget() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      await fetchTickers()
      setQuotes(await fetchQuotes())
      setError(null)
    } catch {
      setError("Couldn't load stock prices.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim()) return
    try {
      await addTicker(draft)
      setDraft('')
      await load()
    } catch {
      setError("Couldn't add ticker.")
    }
  }

  const handleDelete = async (symbol: string) => {
    try {
      await deleteTicker(symbol)
      await load()
    } catch {
      setError("Couldn't remove ticker.")
    }
  }

  return (
    <div className="widget-card stock-widget">
      <div className="stock-widget__header">
        <h2>Stocks</h2>
        <div className="stock-widget__header-actions">
          <a
            className="portfolio-link"
            href="https://digital.fidelity.com/ftgw/digital/portfolio/summary"
            target="_blank"
            rel="noopener noreferrer"
          >
            Portfolio ↗
          </a>
          <button type="button" className="stock-widget__refresh" onClick={load} disabled={loading} aria-label="Refresh stock prices">
            ↻
          </button>
        </div>
      </div>
      {error && <p className="notes-error">{error}</p>}
      <ul className="stock-widget__list">
        {quotes.map((quote) => (
          <li key={quote.symbol} className="stock-widget__row">
            <span className="stock-widget__symbol">{quote.symbol}</span>
            {quote.price !== null && <span className="stock-widget__price">{quote.price.toFixed(2)}</span>}
            {quote.changePercent !== null && (
              <span className={quote.changePercent >= 0 ? 'stock-widget__change--up' : 'stock-widget__change--down'}>
                {percentFormatter.format(quote.changePercent / 100)}
              </span>
            )}
            <button
              type="button"
              className="notes-item__delete"
              aria-label={`Remove ticker: ${quote.symbol}`}
              onClick={() => handleDelete(quote.symbol)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <form className="notes-form" onSubmit={submit}>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add a ticker (e.g. AAPL)…" />
        <button type="submit">Add</button>
      </form>
    </div>
  )
}
