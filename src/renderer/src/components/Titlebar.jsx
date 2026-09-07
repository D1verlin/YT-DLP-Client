import { Minus, Square, X } from 'lucide-react'
import useStore from '../store/useStore'
import { t } from '../utils/i18n'

export default function Titlebar({ page }) {
  const language = useStore((s) => s.language)

  const pageTitles = {
    add:      t('titleAdd', language),
    queue:    t('titleQueue', language),
    settings: t('titleSettings', language)
  }

  return (
    <header className="titlebar drag">
      <span className="titlebar-title">{pageTitles[page] ?? 'YT-DLP Client'}</span>
      <div className="titlebar-controls no-drag">
        <button className="titlebar-btn" title={t('minimize', language)} onClick={() => window.api.minimizeWindow()}>
          <Minus size={14} />
        </button>
        <button className="titlebar-btn" title={t('maximize', language)} onClick={() => window.api.maximizeWindow()}>
          <Square size={12} />
        </button>
        <button className="titlebar-btn close" title={t('close', language)} onClick={() => window.api.closeWindow()}>
          <X size={14} />
        </button>
      </div>
    </header>
  )
}
