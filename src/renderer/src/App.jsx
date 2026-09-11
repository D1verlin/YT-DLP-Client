import { useState, useEffect, useRef } from 'react'
import { Link as LinkIcon } from 'lucide-react'
import Sidebar from './components/Sidebar'
import Titlebar from './components/Titlebar'
import AddPage from './pages/Add'
import QueuePage from './pages/Queue'
import SettingsPage from './pages/Settings'
import SetupPage from './pages/Setup'
import useStore from './store/useStore'
import { t } from './utils/i18n'

export default function App() {
  const [page, setPage] = useState('add')
  const isSetupActive = useStore((state) => state.isSetupActive)
  const setIsSetupActive = useStore((state) => state.setIsSetupActive)
  const language = useStore((state) => state.language)

  const [isGlobalDragging, setIsGlobalDragging] = useState(false)
  const dragCounter = useRef(0)

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

    // ── Robust Multi-Format Global Drag & Drop Handler ─────────
    const extractUrlFromDrag = async (e) => {
      if (!e.dataTransfer) return null

      // 1. URL or text/uri-list (standards-based URL formats)
      const uriList = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('URL')
      if (uriList) {
        const lines = uriList.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
        for (const line of lines) {
          if (/^https?:\/\//i.test(line)) return line
        }
      }

      // 2. Firefox specific format: text/x-moz-url ("url\ntitle")
      try {
        const mozUrl = e.dataTransfer.getData('text/x-moz-url')
        if (mozUrl) {
          const firstLine = mozUrl.split(/\r?\n/)[0].trim()
          if (/^https?:\/\//i.test(firstLine)) return firstLine
        }
      } catch {}

      // 3. Plain text
      const plain = e.dataTransfer.getData('text/plain') || ''
      if (plain && plain.trim()) {
        const m = plain.match(/https?:\/\/[^\s"'<>]+/i)
        if (m) return m[0]
        const domainMatch = plain.match(/(?:www\.)?(?:youtube\.com|youtu\.be|vk\.com|vkvideo\.ru|rutube\.ru|tiktok\.com|twitch\.tv|soundcloud\.com|vimeo\.com|bilibili\.com)\/[^\s"'<>]+/i)
        if (domainMatch) return 'https://' + domainMatch[0]
      }

      // 4. HTML snippet (e.g. dragging a link element in Chromium)
      try {
        const html = e.dataTransfer.getData('text/html') || ''
        if (html) {
          const hrefMatch = html.match(/href=["'](https?:\/\/[^"']+)["']/i)
          if (hrefMatch) return hrefMatch[1]
          const srcMatch = html.match(/src=["'](https?:\/\/[^"']+)["']/i)
          if (srcMatch) return srcMatch[1]
        }
      } catch {}

      // 5. Files: check for .url or .webloc or text file
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0]
        if (file && (file.name.toLowerCase().endsWith('.url') || file.name.toLowerCase().endsWith('.webloc') || file.type.includes('text'))) {
          try {
            const fileText = await file.text()
            const m = fileText.match(/URL=(https?:\/\/[^\r\n]+)/i) || fileText.match(/https?:\/\/[^\s"'<>]+/i)
            if (m) return m[1] || m[0]
          } catch {}
        }
      }

      return null
    }

    const handleDragEnter = (e) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounter.current += 1
      if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.length > 0) {
        setIsGlobalDragging(true)
      }
    }

    const handleDragOver = (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy'
      }
    }

    const handleDragLeave = (e) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounter.current -= 1
      if (dragCounter.current <= 0) {
        dragCounter.current = 0
        setIsGlobalDragging(false)
      }
    }

    const handleDrop = async (e) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounter.current = 0
      setIsGlobalDragging(false)

      const candidate = await extractUrlFromDrag(e)
      if (candidate && candidate.trim()) {
        useStore.getState().setPendingUrl(candidate.trim())
        setPage('add')
      }
    }

    window.addEventListener('dragenter', handleDragEnter, true)
    window.addEventListener('dragover', handleDragOver, true)
    window.addEventListener('dragleave', handleDragLeave, true)
    window.addEventListener('drop', handleDrop, true)

    const unsubLink = window.api.onLinkDropped?.((droppedUrl) => {
      if (droppedUrl) {
        let clean = droppedUrl.trim()
        const m = clean.match(/https?:\/\/[^\s"'<>]+/i)
        if (m) clean = m[0]
        useStore.getState().setPendingUrl(clean)
        setPage('add')
      }
    })

    return () => {
      unsubTask?.()
      unsubProgress?.()
      window.removeEventListener('dragenter', handleDragEnter, true)
      window.removeEventListener('dragover', handleDragOver, true)
      window.removeEventListener('dragleave', handleDragLeave, true)
      window.removeEventListener('drop', handleDrop, true)
      unsubLink?.()
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
    <div className="app-container" style={{ position: 'relative' }}>
      {isGlobalDragging && (
        <div style={{ position: 'fixed', inset: 8, background: 'rgba(18, 18, 18, 0.88)', backdropFilter: 'blur(8px)', zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed rgba(255, 255, 255, 0.4)', borderRadius: 12, pointerEvents: 'none' }}>
          <LinkIcon size={44} style={{ color: '#fff', marginBottom: 12 }} />
          <span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>{t('dragDropHint', language)}</span>
        </div>
      )}
      <Sidebar current={page} onNav={setPage} />
      <div className="workspace">
        <Titlebar page={page} />
        {pages[page]}
      </div>
    </div>
  )
}
