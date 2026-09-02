import './App.css'
import { WidgetCard } from './components/WidgetCard'
import { leftWidgets, rightWidgets } from './data/mockWidgets'

export default function App() {
  return (
    <div className="dashboard">
      <aside aria-label="Job tracking and notes">
        {leftWidgets.map((widget) => (
          <WidgetCard key={widget.title} {...widget} />
        ))}
      </aside>
      <main aria-label="Horong chat column" />
      <aside aria-label="Finance and stocks">
        {rightWidgets.map((widget) => (
          <WidgetCard key={widget.title} {...widget} />
        ))}
      </aside>
    </div>
  )
}
