import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Titlebar from './components/Titlebar'
import AddPage from './pages/Add'
import QueuePage from './pages/Queue'
import SettingsPage from './pages/Settings'
import SetupPage from './pages/Setup'
import useStore from './store/useStore'

export default function App() {
  const [page, setPage] = useState('add')
  const isSetupActive = useStore((state) => state.isSetupActive)
  const setIsSetupActive = useStore((state) => state.setIsSetupActive)

  useEffect(() => {
    // Sync language from saved settings
    window.api.getSettings?.().then((settings) => {
      if (settings?.language) {
        useStore.getState().setLanguage(settings.language)
      }
    })

    // Check if first-run setup is needed
    window.api.checkBinaries?.().then((res) => {
      if (res?.firstRun) {
        setIsSetupActive(true)
      }
    }).catch(() => {})

    // Restore existing tasks from backend queue
    window.api.getTasks?.().then((tasks) => {
      if (tasks && tasks.length > 0) {
        useStore.getState().setTasks(tasks)
      }
    })

    const unsubTask = window.api.onTaskUpdate?.((task) => {
      useStore.getState().updateTask(task)
    })
    const unsubProgress = window.api.onProgress?.((data) => {
      useStore.getState().updateTaskProgress(data)
    })

    return () => {
      unsubTask?.()
      unsubProgress?.()
    }
  }, [])

  const handleSetupComplete = () => {
    setIsSetupActive(false)
    setPage('add')
  }

  if (isSetupActive) {
    return (
      <div className="app-container setup-mode">
        <div className="workspace setup-workspace">
          <header className="titlebar drag">
            <span className="titlebar-title">YT-DLP Client — Setup</span>
            <div className="titlebar-controls no-drag">
              <button className="titlebar-btn" title="Minimize" onClick={() => window.api.minimizeWindow()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /></svg>
              </button>
              <button className="titlebar-btn" title="Maximize" onClick={() => window.api.maximizeWindow()}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>
              </button>
              <button className="titlebar-btn close" title="Close" onClick={() => window.api.closeWindow()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          </header>
          <SetupPage onComplete={handleSetupComplete} />
        </div>
      </div>
    )
  }

  const pages = {
    add:      <AddPage onNav={setPage} />,
    queue:    <QueuePage onNav={setPage} />,
    settings: <SettingsPage />
  }

  return (
    <div className="app-container">
      <Sidebar current={page} onNav={setPage} />
      <div className="workspace">
        <Titlebar page={page} />
        {pages[page]}
      </div>
    </div>
  )
}
