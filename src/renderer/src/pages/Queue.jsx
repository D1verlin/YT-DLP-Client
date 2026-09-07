import { useState, useMemo, useEffect } from 'react'
import {
  Plus,
  Download,
  Search,
  X,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  Filter
} from 'lucide-react'
import useStore from '../store/useStore'
import DownloadCard from '../components/DownloadCard'
import { calculateTotalSpeed } from '../utils/platformHelper'
import { t } from '../utils/i18n'

export default function QueuePage({ onNav }) {
  const tasks = useStore((s) => s.tasks)
  const setTasks = useStore((s) => s.setTasks)
  const clearCompletedTasks = useStore((s) => s.clearCompletedTasks)
  const lang = useStore((s) => s.language)

  const [filterTab, setFilterTab] = useState('all') // 'all' | 'active' | 'completed' | 'errors'
  const [searchQuery, setSearchQuery] = useState('')

  // Sync files from disk on mount to remove any deleted ghost tasks
  useEffect(() => {
    window.api.syncFiles?.().then((res) => {
      if (res && res.tasks) {
        setTasks(res.tasks)
      }
    })
  }, [setTasks])

  // Statistics
  const activeTasks = useMemo(
    () => tasks.filter((t) => t.status === 'downloading' || t.status === 'pending'),
    [tasks]
  )
  const completedTasks = useMemo(
    () => tasks.filter((t) => t.status === 'completed'),
    [tasks]
  )
  const errorTasks = useMemo(
    () => tasks.filter((t) => t.status === 'error' || t.status === 'cancelled'),
    [tasks]
  )
  const totalSpeed = useMemo(() => calculateTotalSpeed(tasks), [tasks])

  // Filter & Search
  const filteredTasks = useMemo(() => {
    let list = tasks

    if (filterTab === 'active') {
      list = list.filter((t) => t.status === 'downloading' || t.status === 'pending')
    } else if (filterTab === 'completed') {
      list = list.filter((t) => t.status === 'completed')
    } else if (filterTab === 'errors') {
      list = list.filter((t) => t.status === 'error' || t.status === 'cancelled')
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter((t) => {
        const titleMatch = (t.title || '').toLowerCase().includes(q)
        const urlMatch = (t.url || '').toLowerCase().includes(q)
        const playlistMatch = (t.playlistTitle || '').toLowerCase().includes(q)
        return titleMatch || urlMatch || playlistMatch
      })
    }

    return list
  }, [tasks, filterTab, searchQuery])

  // Bulk Actions
  const handleClearCompleted = () => {
    window.api.clearCompletedDownloads?.()
    clearCompletedTasks()
  }

  return (
    <div className="page-content queue-page-v2">
      {/* ── Top Header Row ────────────────────────────────────────────── */}
      <div className="queue-header-row">
        <div className="queue-title-wrap">
          <h1 className="queue-page-title">{t('queueTitle', lang)}</h1>
          <span className="queue-badge-total">{tasks.length}</span>
        </div>

        <div className="queue-header-actions">
          <button className="btn btn-primary btn-sm" onClick={() => onNav?.('add')}>
            <Plus size={15} />
            <span>{t('navAdd', lang)}</span>
          </button>
        </div>
      </div>

      {/* ── Real-Time Stats Dashboard Bar ──────────────────────────────── */}
      <div className="queue-stats-dashboard">
        {/* Stat 1: Всего */}
        <div
          className={`stat-card ${filterTab === 'all' ? 'is-active' : ''}`}
          onClick={() => setFilterTab('all')}
        >
          <div className="stat-card-icon-wrap default">
            <Download size={16} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-num">{tasks.length}</span>
            <span className="stat-card-label">{t('statTotal', lang)}</span>
          </div>
        </div>

        {/* Stat 2: Активные */}
        <div
          className={`stat-card ${filterTab === 'active' ? 'is-active' : ''}`}
          onClick={() => setFilterTab('active')}
        >
          <div className="stat-card-icon-wrap active">
            <Clock size={16} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-num">{activeTasks.length}</span>
            <span className="stat-card-label">{t('statActive', lang)}</span>
          </div>
        </div>

        {/* Stat 3: Завершено */}
        <div
          className={`stat-card ${filterTab === 'completed' ? 'is-active' : ''}`}
          onClick={() => setFilterTab('completed')}
        >
          <div className="stat-card-icon-wrap success">
            <CheckCircle2 size={16} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-num">{completedTasks.length}</span>
            <span className="stat-card-label">{t('statCompleted', lang)}</span>
          </div>
        </div>

        {/* Stat 4: Ошибки */}
        <div
          className={`stat-card ${filterTab === 'errors' ? 'is-active' : ''}`}
          onClick={() => setFilterTab('errors')}
        >
          <div className="stat-card-icon-wrap error">
            <AlertCircle size={16} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-num">{errorTasks.length}</span>
            <span className="stat-card-label">{t('statAttention', lang)}</span>
          </div>
        </div>

        {/* Stat 5: Скорость сети */}
        {totalSpeed && (
          <div className="stat-card speed-card">
            <div className="stat-card-icon-wrap speed">
              <Zap size={16} />
            </div>
            <div className="stat-card-info">
              <span className="stat-card-num">{totalSpeed}</span>
              <span className="stat-card-label">{t('statSpeed', lang)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Filters & Search Toolbar ──────────────────────────────────── */}
      {tasks.length > 0 && (
        <div className="queue-toolbar-row">
          {/* Tab Filter Chips */}
          <div className="queue-filter-tabs">
            <button
              className={`filter-tab-btn ${filterTab === 'all' ? 'active' : ''}`}
              onClick={() => setFilterTab('all')}
            >
              {t('tabAll', lang)}
              <span className="tab-pill">{tasks.length}</span>
            </button>
            <button
              className={`filter-tab-btn ${filterTab === 'active' ? 'active' : ''}`}
              onClick={() => setFilterTab('active')}
            >
              {t('tabActive', lang)}
              <span className="tab-pill">{activeTasks.length}</span>
            </button>
            <button
              className={`filter-tab-btn ${filterTab === 'completed' ? 'active' : ''}`}
              onClick={() => setFilterTab('completed')}
            >
              {t('tabCompleted', lang)}
              <span className="tab-pill">{completedTasks.length}</span>
            </button>
            {errorTasks.length > 0 && (
              <button
                className={`filter-tab-btn ${filterTab === 'errors' ? 'active' : ''}`}
                onClick={() => setFilterTab('errors')}
              >
                {t('tabErrors', lang)}
                <span className="tab-pill alert">{errorTasks.length}</span>
              </button>
            )}
          </div>

          {/* Right Toolbar: Bulk Actions & Search */}
          <div className="queue-toolbar-right">
            {completedTasks.length > 0 && (
              <div className="queue-bulk-actions">
                <button
                  className="queue-bulk-btn danger"
                  onClick={handleClearCompleted}
                  title={t('btnClearCompleted', lang)}
                >
                  <Trash2 size={13} />
                  <span>{t('btnClearCompleted', lang)}</span>
                </button>
              </div>
            )}

            {/* Quick Search */}
            <div className="queue-search-box">
              <Search size={14} className="queue-search-icon" />
              <input
                type="text"
                className="queue-search-input"
                placeholder={t('searchPlaceholder', lang)}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="queue-search-clear"
                  onClick={() => setSearchQuery('')}
                  title={t('searchPlaceholder', lang)}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Task List ─────────────────────────────────────────────────── */}
      {filteredTasks.length > 0 ? (
        <div className="queue-task-list">
          {filteredTasks.map((tItem) => (
            <DownloadCard key={tItem.id} task={tItem} />
          ))}
        </div>
      ) : tasks.length > 0 ? (
        /* Empty Search Results */
        <div className="queue-empty-search">
          <Filter size={36} className="text-sec opacity-40" />
          <p className="empty-search-title">{t('searchEmptyTitle', lang)}</p>
          <p className="empty-search-desc">
            {t('searchEmptyDesc', lang, { query: searchQuery })}
          </p>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearchQuery('')
              setFilterTab('all')
            }}
          >
            {t('btnResetFilters', lang)}
          </button>
        </div>
      ) : (
        /* Zero State (No downloads at all) */
        <div className="queue-zero-state">
          <div className="zero-icon-orb">
            <Download size={44} strokeWidth={1.5} />
          </div>
          <h2 className="zero-title">{t('zeroTitle', lang)}</h2>
          <p className="zero-desc">
            {t('zeroDesc', lang)}
          </p>
          <button
            className="btn btn-primary btn-lg zero-btn"
            onClick={() => onNav?.('add')}
          >
            <Plus size={18} />
            <span>{t('btnAddFirst', lang)}</span>
          </button>
        </div>
      )}
    </div>
  )
}


