import type { MockWidget } from '../data/mockWidgets'

export function WidgetCard({ title, lines, headerLink }: MockWidget) {
  return (
    <div className="widget-card">
      <div className="widget-card__header">
        <h2>{title}</h2>
        {headerLink && (
          <a className="portfolio-link" href={headerLink.href} target="_blank" rel="noopener noreferrer">
            {headerLink.text}
          </a>
        )}
      </div>
      <ul>
        {lines.map((line) => (
          <li key={line.text}>
            {line.href ? (
              <a href={line.href} target="_blank" rel="noopener noreferrer">
                {line.text}
              </a>
            ) : (
              line.text
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
