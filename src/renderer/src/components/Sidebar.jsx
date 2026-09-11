import { useState, useEffect } from 'react'
import { Plus, Download, Settings } from 'lucide-react'
import useStore from '../store/useStore'
import logoSvg from '../assets/logo.svg'
import { t } from '../utils/i18n'

export default function Sidebar({ current, onNav, dimmed }) {
  const language = useStore((s) => s.language)
  const activeCount = useStore((s) =>
    s.tasks.filter((t) => t.status === 'downloading' || t.status === 'pending').length
  )
  const [hasUpdate, setHasUpdate] = useState(false)

  useEffect(() => {
    window.api.getAppUpdateState?.().then((st) => {
      if (st?.status === 'available') setHasUpdate(true)
    })
    const unsub = window.api.onAppUpdateStatus?.((st) => {
      setHasUpdate(st?.status === 'available')
    })
    return () => unsub?.()
  }, [])

  const topNav = [
    { id: 'add',   label: t('navAdd', language),   Icon: Plus },
    { id: 'queue', label: t('navQueue', language), Icon: Download }
  ]

  const bottomNav = [
    { id: 'settings', label: t('navSettings', language), Icon: Settings }
  ]

  const renderItem = ({ id, label, Icon }) => {
    const isActive = !dimmed && current === id
    return (
      <button
        key={id}
        className={`nav-item no-drag ${isActive ? 'active' : ''}`}
        onClick={() => !dimmed && onNav(id)}
        aria-label={label}
        style={dimmed ? { opacity: 0.35, cursor: 'default', pointerEvents: 'none' } : {}}
      >
        <Icon size={19} strokeWidth={1.8} />
        {id === 'queue' && activeCount > 0 && (
          <span className="nav-badge-count">{activeCount}</span>
        )}
        {id === 'settings' && hasUpdate && (
          <span className="nav-update-dot" title={t('otaAvailable', language)} />
        )}
        <span className="nav-tooltip">{label}</span>
      </button>
    )
  }

  return (
    <aside className="sidebar drag">
      <div className="sidebar-top">
        <div
          className="sidebar-logo no-drag"
          onClick={() => !dimmed && onNav('add')}
          style={{ cursor: 'pointer' }}
          title="YT-DLP Client"
        >
          <img src={logoSvg} alt="YT-DLP Client" className="sidebar-logo-img" />
        </div>

        <nav className="nav-group">
          {topNav.map(renderItem)}
        </nav>
      </div>

      <div className="sidebar-bottom">
        <nav className="nav-group">
          {bottomNav.map(renderItem)}
        </nav>
      </div>
    </aside>
  )
}
