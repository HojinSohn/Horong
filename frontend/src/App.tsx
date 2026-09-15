import { useState } from 'react'
import './App.css'
import { ChatPanel } from './components/ChatPanel'
import { FinanceWidget } from './components/FinanceWidget'
import { NotesWidget } from './components/NotesWidget'
import { StockWidget } from './components/StockWidget'
import { WidgetCard } from './components/WidgetCard'
import { jobWidgets } from './data/mockWidgets'

const BRIDGE_WS_URL = import.meta.env.VITE_BRIDGE_WS_URL ?? 'ws://horong.taila5421b.ts.net:8765/ws'

type MobileTab = 'chat' | 'finance' | 'jobs'

const MOBILE_TABS: { id: MobileTab; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'finance', label: 'Finance' },
  { id: 'jobs', label: 'Jobs' },
]

export default function App() {
  const [notesRefreshKey, setNotesRefreshKey] = useState(0)
  const [mobileTab, setMobileTab] = useState<MobileTab>('chat')

  return (
    <>
      <div className="dashboard" data-mobile-tab={mobileTab}>
        <aside aria-label="Finance and stocks" className="finance-stocks-column">
          <div className="finance-stocks-column__half">
            <FinanceWidget />
          </div>
          <div className="finance-stocks-column__half">
            <StockWidget />
          </div>
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
      <nav className="mobile-tab-bar" aria-label="Choose panel">
        {MOBILE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={mobileTab === tab.id ? 'mobile-tab-bar__tab mobile-tab-bar__tab--active' : 'mobile-tab-bar__tab'}
            aria-pressed={mobileTab === tab.id}
            onClick={() => setMobileTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </>
  )
}
