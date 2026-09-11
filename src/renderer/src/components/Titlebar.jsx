import { useEffect } from 'react'
import { Minus, Square, X } from 'lucide-react'
import useStore from '../store/useStore'
import { t } from '../utils/i18n'

export default function Titlebar({ page }) {
  const language = useStore((s) => s.language)
  const isMaximized = useStore((s) => s.isMaximized)
  const setIsMaximized = useStore((s) => s.setIsMaximized)

  useEffect(() => {
    window.api.isMaximized?.().then((max) => {
      if (typeof max === 'boolean') setIsMaximized(max)
    })

    const unsub = window.api.onWindowStateChange?.((max) => {
      setIsMaximized(max)
    })

    return () => {
      unsub?.()
    }
  }, [setIsMaximized])

  const pageTitles = {
    add:      t('titleAdd', language),
    queue:    t('titleQueue', language),
    settings: t('titleSettings', language)
  }

  return (
    <header
      className="titlebar drag"
      onDoubleClick={() => window.api.maximizeWindow()}
    >
      <span className="titlebar-title">{pageTitles[page] ?? 'YT-DLP Client'}</span>
      <div className="titlebar-controls no-drag">
        <button className="titlebar-btn" title={t('minimize', language)} onClick={() => window.api.minimizeWindow()}>
          <Minus size={14} />
        </button>
        <button
          className="titlebar-btn"
          title={isMaximized ? t('restore', language) : t('maximize', language)}
          onClick={() => window.api.maximizeWindow()}
        >
          {isMaximized ? (
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3 5v9h9V5H3zm8 8H4V6h7v7z"/>
              <path d="M5 2h9v9h-2V3H5V2z"/>
            </svg>
          ) : (
            <Square size={12} />
          )}
        </button>
        <button className="titlebar-btn close" title={t('close', language)} onClick={() => window.api.closeWindow()}>
          <X size={14} />
        </button>
      </div>
    </header>
  )
}
