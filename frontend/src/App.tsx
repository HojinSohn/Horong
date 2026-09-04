import { useState } from 'react'
import './App.css'
import { ChatPanel } from './components/ChatPanel'
import { FinanceWidget } from './components/FinanceWidget'
import { NotesWidget } from './components/NotesWidget'
import { WidgetCard } from './components/WidgetCard'
import { jobWidgets, stockWidgets } from './data/mockWidgets'

const BRIDGE_WS_URL = import.meta.env.VITE_BRIDGE_WS_URL ?? 'ws://100.109.58.59:8765/ws'

export default function App() {
  const [notesRefreshKey, setNotesRefreshKey] = useState(0)

  return (
    <div className="dashboard">
      <aside aria-label="Finance and stocks">
        <FinanceWidget />
        {stockWidgets.map((widget) => (
          <WidgetCard key={widget.title} {...widget} />
        ))}
      </aside>
      <main aria-label="Horong chat column">
        <ChatPanel wsUrl={BRIDGE_WS_URL} onTurnComplete={() => setNotesRefreshKey((key) => key + 1)} />
      </main>
      <aside aria-label="Job tracking and notes" className="job-notes-column">
        <div className="job-notes-column__half">
          {jobWidgets.map((widget) => (
            <WidgetCard key={widget.title} {...widget} />
          ))}
        </div>
        <div className="job-notes-column__half">
          <NotesWidget refreshKey={notesRefreshKey} />
        </div>
      </aside>
    </div>
  )
}
