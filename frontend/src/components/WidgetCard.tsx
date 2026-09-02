import type { MockWidget } from '../data/mockWidgets'

export function WidgetCard({ title, lines }: MockWidget) {
  return (
    <div className="widget-card">
      <h2>{title}</h2>
      <ul>
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  )
}
