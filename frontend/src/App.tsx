import './App.css'
import { ChatPanel } from './components/ChatPanel'
import { WidgetCard } from './components/WidgetCard'
import { leftWidgets, rightWidgets } from './data/mockWidgets'

const BRIDGE_WS_URL = import.meta.env.VITE_BRIDGE_WS_URL ?? 'ws://100.109.58.59:8765/ws'

export default function App() {
  return (
    <div className="dashboard">
      <aside aria-label="Job tracking and notes">
        {leftWidgets.map((widget) => (
          <WidgetCard key={widget.title} {...widget} />
        ))}
      </aside>
      <main aria-label="Horong chat column">
        <ChatPanel wsUrl={BRIDGE_WS_URL} />
      </main>
      <aside aria-label="Finance and stocks">
        {rightWidgets.map((widget) => (
          <WidgetCard key={widget.title} {...widget} />
        ))}
      </aside>
    </div>
  )
}
