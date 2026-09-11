import { useState } from 'react'
import {
  Play,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Trash2,
  FolderOpen,
  ExternalLink,
  Zap,
  HardDrive,
  Layers,
  Sparkles,
  Film,
  Music,
  Download as DownloadIcon,
  XCircle,
  FileText,
  Copy,
  Check,
  Scissors,
  ListVideo,
  ChevronDown,
  Search,
  Loader2
} from 'lucide-react'
import { detectPlatform, formatSpeed, formatSize, formatDuration } from '../utils/platformHelper'
import useStore from '../store/useStore'
import { t } from '../utils/i18n'

const STATUS_CONFIG = {
  pending: {
    key: 'statusPending',
    cls: 'status-pending',
    Icon: Clock,
    color: '#888888'
  },
  downloading: {
    key: 'statusDownloading',
    cls: 'status-downloading',
    Icon: DownloadIcon,
    color: '#ffffff'
  },
  completed: {
    key: 'statusCompleted',
    cls: 'status-completed',
    Icon: CheckCircle2,
    color: '#ffffff'
  },
  error: {
    key: 'statusError',
    cls: 'status-error',
    Icon: AlertCircle,
    color: '#ef5350'
  },
  cancelled: {
    key: 'statusCancelled',
    cls: 'status-cancelled',
    Icon: XCircle,
    color: '#777777'
  }
}

function formatStreamLabel(label, task, lang) {
  if (!label) return ''
  if (label === 'Объединение...' || label === 'Merging...') {
    return t('streamMerging', lang)
  }
  if (label === 'Видео' || label === 'Video' || label === 'video') {
    return t('streamVideo', lang)
  }
  if (label === 'Аудио' || label === 'Audio' || label === 'audio') {
    return t('streamAudio', lang)
  }
  const digits = label.match(/\d+/g)
  if (digits && digits.length >= 2 && /(?:трек|track)/i.test(label)) {
    return t('trackProgress', lang, { current: digits[0], total: digits[1] })
  }
  return label
}

export default function DownloadCard({ task }) {
  const removeTask = useStore((s) => s.removeTask)
  const lang = useStore((s) => s.language)
  const [actionError, setActionError] = useState(null)
  const [showLogs, setShowLogs] = useState(false)
  const [copiedLog, setCopiedLog] = useState(false)
  const [showTracks, setShowTracks] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const isPlaylist = Boolean(task.config?.isPlaylist || task.playlistTotal || (task.entries && task.entries.length > 0))
  const entries = Array.isArray(task.entries) ? task.entries : []
  const hasEntries = entries.length > 0
  const isAudioOnly = task.config?.format === 'audio'
  const isMerging = task.streamLabel === 'Объединение...' || task.streamLabel === 'Merging...'
  const isActive = task.status === 'downloading'

  const completedUnits = entries.filter((e) => e.status === 'completed').length
  const downloadingUnits = entries.filter((e) => e.status === 'downloading').length
  const errorUnits = entries.filter((e) => e.status === 'error').length
  const pendingUnits = entries.filter((e) => e.status === 'pending' || !e.status).length

  const playlistDir = task.filePath
    ? task.filePath.replace(/[\\/][^\\/]+$/, '')
    : null

  const filteredEntries = entries.filter((e) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      (e.title && e.title.toLowerCase().includes(q)) ||
      (e.uploader && e.uploader.toLowerCase().includes(q)) ||
      String(e.index).includes(q)
    )
  })

  const statusInfo = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending
  const platform = detectPlatform(task.url, task.config?.platform)

  // Quality badge text
  const qualityText = isAudioOnly
    ? (lang === 'en' ? 'MP3 Audio' : 'MP3 Аудио')
    : task.config?.quality === 'best'
      ? (lang === 'en' ? 'MP4 Best' : 'MP4 Лучшее')
      : task.config?.quality
        ? `MP4 ${task.config.quality}p`
        : (lang === 'en' ? 'MP4 Video' : 'MP4 Видео')

  // Action handlers with error handling
  const handleOpenFile = async () => {
    setActionError(null)
    if (task.filePath) {
      const res = await window.api.openFile(task.filePath)
      if (res && !res.success && res.error) {
        setActionError(res.error)
        setTimeout(() => setActionError(null), 4000)
      }
    }
  }

  const handleShowInFolder = async () => {
    setActionError(null)
    const target = (isPlaylist && playlistDir) ? playlistDir : task.filePath
    const res = await window.api.showInFolder(target)
    if (res && !res.success && res.error) {
      setActionError(res.error)
      setTimeout(() => setActionError(null), 4000)
    }
  }

  const handleOpenLink = () => {
    if (task.url) {
      window.api.openExternal(task.url)
    }
  }

  const handleCancel = () => {
    window.api.cancelDownload(task.id)
  }

  const handleRetry = () => {
    window.api.retryDownload?.(task.id)
  }

  const handleRemove = () => {
    window.api.removeDownload?.(task.id)
    removeTask(task.id)
  }

  return (
    <div className={`task-card-v2 status-${task.status} ${isPlaylist ? 'is-playlist-card' : ''}`}>
      {/* ── Main Task Row ───────────────────────────────────────────── */}
      <div className="task-card-main-row">
        {/* Left: Thumbnail / Poster */}
        <div className={`task-poster-wrap ${isPlaylist ? 'playlist-stack' : ''}`}>
          {isPlaylist && (
            <>
              <div className="playlist-stack-layer layer-2" />
              <div className="playlist-stack-layer layer-1" />
            </>
          )}
          <div className="playlist-poster-inner">
            {task.thumbnail ? (
              <img src={task.thumbnail} alt="" className="task-poster-img" />
            ) : (
              <div className="task-poster-fallback">
                {isPlaylist ? (
                  <Layers size={22} className="text-sec" />
                ) : isAudioOnly ? (
                  <Music size={22} className="text-sec" />
                ) : (
                  <Film size={22} className="text-sec" />
                )}
              </div>
            )}

            {/* Media type overlay badge */}
            <div className="task-poster-badge">
              {isPlaylist ? (
                <span className="task-mini-pill playlist">
                  <Layers size={10} />
                  {hasEntries
                    ? t('playlistUnitsCount', lang, { count: entries.length })
                    : task.playlistTotal
                      ? t('playlistUnitsCount', lang, { count: task.playlistTotal })
                      : t('playlistBadge', lang)}
                </span>
              ) : task.duration ? (
                <span className="task-mini-pill duration">
                  {formatDuration(task.duration)}
                </span>
              ) : isAudioOnly ? (
                <span className="task-mini-pill audio">
                  <Music size={10} /> MP3
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Center: Main Content & Progress */}
        <div className="task-center-content">
          {/* Top row: Title + Badges */}
          <div className="task-header-row">
            <div className="task-title-group">
              <h3
                className="task-main-title"
                title={task.title || task.playlistTitle || task.url}
                onClick={handleOpenFile}
              >
                {task.title || task.playlistTitle || task.url}
              </h3>
              <div className="task-meta-chips">
                {/* Platform badge */}
                <span className={`task-chip platform ${platform.badgeCls}`}>
                  <span className="chip-dot" style={{ background: platform.name.toLowerCase().includes('youtube') ? '#ef5350' : '#ffffff' }} />
                  {platform.name}
                </span>

                {/* Quality / Format chip */}
                <span className="task-chip format">
                  {isAudioOnly ? <Music size={11} /> : <Film size={11} />}
                  {qualityText}
                </span>

                {/* Video Codec / Audio Bitrate chips */}
                {task.config?.videoCodec && task.config.videoCodec !== 'default' && (
                  <span className="task-chip">
                    {task.config.videoCodec.toUpperCase()}
                  </span>
                )}
                {task.config?.audioBitrate && (
                  <span className="task-chip">
                    {task.config.audioBitrate}
                  </span>
                )}

                {/* Time trimming chip */}
                {task.config?.timeRange && (
                  <span className="task-chip" title="Обрезка видео">
                    <Scissors size={11} />
                    {task.config.timeRange}
                  </span>
                )}

                {/* Playlist Badges & Counter */}
                {isPlaylist && (
                  <>
                    <span className="task-chip is-playlist-pill">
                      <Layers size={11} />
                      {t('playlistBadge', lang)}
                    </span>
                    {hasEntries ? (
                      <span className="task-chip playlist-prog">
                        <CheckCircle2 size={11} />
                        {t('playlistCompletedCount', lang, { completed: completedUnits, total: entries.length })}
                      </span>
                    ) : task.playlistTotal ? (
                      <span className="task-chip playlist-prog">
                        <Layers size={11} />
                        {t('trackProgress', lang, { current: task.playlistCurrent || 0, total: task.playlistTotal })}
                      </span>
                    ) : null}

                    {/* Expand/Collapse Tracks Toggle Button */}
                    {hasEntries && (
                      <button
                        type="button"
                        className={`playlist-tracks-toggle-btn ${showTracks ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowTracks((prev) => !prev)
                        }}
                        title={showTracks ? t('btnHideTracks', lang) : t('btnShowTracks', lang, { count: entries.length })}
                      >
                        <ListVideo size={12} />
                        <span>{showTracks ? t('btnHideTracks', lang) : t('btnShowTracks', lang, { count: entries.length })}</span>
                        <ChevronDown size={12} className={`toggle-chevron ${showTracks ? 'rotated' : ''}`} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Status pill badge */}
            <div className={`task-status-pill ${statusInfo.cls}`}>
              {isMerging ? (
                <>
                  <Sparkles size={12} />
                  <span>{t('statusMerging', lang)}</span>
                </>
              ) : (
                <>
                  <statusInfo.Icon size={12} />
                  <span>{t(statusInfo.key, lang)}</span>
                </>
              )}
            </div>
          </div>

          {/* Active Progress Bar & Stats */}
          {isActive && (
            <div className="task-progress-block">
              <div className="task-progress-labels">
                <div className="progress-left-info">
                  {task.streamLabel && (
                    <span className={`stream-phase-tag ${isMerging ? 'merging' : ''}`}>
                      {isMerging && <Sparkles size={11} />}
                      {isMerging ? t('streamMerging', lang) : formatStreamLabel(task.streamLabel, task, lang)}
                    </span>
                  )}
                  {!isMerging && (
                    <span className="progress-percent-val">
                      {(task.progress || 0).toFixed(1)}%
                    </span>
                  )}
                </div>

                {task.totalSize && !isMerging && (
                  <span className="progress-size-val">
                    <HardDrive size={11} />
                    {formatSize(task.totalSize)}
                  </span>
                )}
              </div>

              {/* Glowing progress track */}
              <div className="task-track-v2">
                {isMerging ? (
                  <div className="task-fill-v2 merging-pulse" />
                ) : (
                  <div
                    className="task-fill-v2 active-glow"
                    style={{ width: `${Math.min(100, Math.max(0, task.progress || 0))}%` }}
                  >
                    <div className="shimmer-glimmer" />
                  </div>
                )}
              </div>

              {/* Metrics: Speed, ETA, Playlist status */}
              <div className="task-metrics-row">
                {task.speed && !isMerging ? (
                  <div className="task-metric-item speed">
                    <Zap size={12} className="metric-icon" />
                    <span>{formatSpeed(task.speed)}</span>
                  </div>
                ) : null}

                {task.eta && !isMerging ? (
                  <div className="task-metric-item eta">
                    <Clock size={12} className="metric-icon" />
                    <span>{t('etaRemaining', lang, { eta: task.eta })}</span>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Completed State Bar */}
          {task.status === 'completed' && (
            <div className="task-completed-bar-row">
              <div className="task-track-v2 completed">
                <div className="task-fill-v2 done" style={{ width: '100%' }} />
              </div>
              {task.filePath && (
                <span className="task-completed-path-text" title={task.filePath}>
                  <FolderOpen size={12} />
                  {task.filePath.split(/[\\/]/).pop()}
                </span>
              )}
            </div>
          )}

          {/* Action error banner */}
          {actionError && (
            <div className="task-action-error-toast">
              <AlertCircle size={13} />
              <span>{actionError}</span>
            </div>
          )}
        </div>

        {/* Right: Action Buttons Grid */}
        <div className="task-actions-grid">
          {/* Completed Actions */}
          {task.status === 'completed' && (
            <>
              <button
                className="btn-action primary"
                title={t('tipPlay', lang)}
                onClick={handleOpenFile}
              >
                <Play size={14} />
              </button>
              <button
                className="btn-action"
                title={t('tipFolder', lang)}
                onClick={handleShowInFolder}
              >
                <FolderOpen size={14} />
              </button>
            </>
          )}

          {/* Downloading Actions */}
          {task.status === 'downloading' && (
            <>
              <button
                className="btn-action"
                title={t('tipFolder', lang)}
                onClick={handleShowInFolder}
              >
                <FolderOpen size={14} />
              </button>
              <button
                className="btn-action danger"
                title={t('tipCancel', lang)}
                onClick={handleCancel}
              >
                <X size={14} />
              </button>
            </>
          )}

          {/* Error / Cancelled Actions */}
          {(task.status === 'error' || task.status === 'cancelled') && (
            <>
              <button
                className="btn-action primary"
                title={t('tipRetry', lang)}
                onClick={handleRetry}
              >
                <RotateCcw size={14} />
              </button>
              <button
                className="btn-action"
                title={t('tipFolder', lang)}
                onClick={handleShowInFolder}
              >
                <FolderOpen size={14} />
              </button>
            </>
          )}

          {/* Always available web link button */}
          {task.url && (
            <button
              className="btn-action"
              title={t('tipLink', lang)}
              onClick={handleOpenLink}
            >
              <ExternalLink size={14} />
            </button>
          )}

          {/* Remove from list (for completed, cancelled, error) */}
          {(task.status === 'completed' ||
            task.status === 'cancelled' ||
            task.status === 'error') && (
            <button
              className="btn-action danger-subtle"
              title={t('tipDelete', lang)}
              onClick={handleRemove}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Error Notification & Log Drawer ─────────────────────────── */}
      {task.status === 'error' && (
        <div className="task-error-container" style={{ marginTop: 8, width: '100%' }}>
          <div className="task-error-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
              <AlertCircle size={14} className="error-box-icon" style={{ flexShrink: 0 }} />
              <span className="error-box-text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {task.errorMessage || t('statusError', lang)}
              </span>
            </div>
            {task.errorLog && task.errorLog.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11, padding: '3px 8px', height: 24, gap: 4, flexShrink: 0 }}
                onClick={() => setShowLogs(!showLogs)}
              >
                <FileText size={12} />
                <span>{showLogs ? t('btnHideLog', lang) : t('btnViewLog', lang)}</span>
              </button>
            )}
          </div>

          {showLogs && task.errorLog && task.errorLog.length > 0 && (
            <div className="task-logs-terminal" style={{ marginTop: 6, padding: '8px 10px', background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, maxHeight: 180, overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>yt-dlp error output</span>
                <button
                  type="button"
                  className="btn-copy-log"
                  onClick={() => {
                    navigator.clipboard.writeText(task.errorLog.join('\n'))
                    setCopiedLog(true)
                    setTimeout(() => setCopiedLog(false), 2000)
                  }}
                >
                  {copiedLog ? <Check size={11} /> : <Copy size={11} />}
                  <span>{copiedLog ? t('logCopied', lang) : t('btnCopyLog', lang)}</span>
                </button>
              </div>
              <pre style={{ margin: 0, fontSize: 11, fontFamily: 'monospace', color: '#ff6b6b', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {task.errorLog.join('\n')}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ── Expandable Playlist Units Drawer ───────────────────────────── */}
      {isPlaylist && hasEntries && showTracks && (
        <div className="playlist-units-drawer">
          {/* Drawer Toolbar */}
          <div className="playlist-drawer-toolbar">
            <div className="playlist-search-box">
              <Search size={13} className="playlist-search-icon" />
              <input
                type="text"
                className="playlist-search-input"
                placeholder={t('playlistSearchPlaceholder', lang)}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="playlist-search-clear"
                  onClick={() => setSearchQuery('')}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="playlist-status-summary">
              <span className="unit-summary-pill ready">
                <CheckCircle2 size={11} />
                <span>{t('statusSummaryReady', lang, { count: completedUnits })}</span>
              </span>
              {downloadingUnits > 0 && (
                <span className="unit-summary-pill active">
                  <Loader2 size={11} className="spin" />
                  <span>{t('statusSummaryActive', lang, { count: downloadingUnits })}</span>
                </span>
              )}
              {pendingUnits > 0 && (
                <span className="unit-summary-pill waiting">
                  <Clock size={11} />
                  <span>{t('statusSummaryWaiting', lang, { count: pendingUnits })}</span>
                </span>
              )}
              {errorUnits > 0 && (
                <span className="unit-summary-pill error">
                  <AlertCircle size={11} />
                  <span>{errorUnits}</span>
                </span>
              )}
            </div>

            {playlistDir && (
              <button
                type="button"
                className="playlist-folder-btn"
                onClick={() => window.api.showInFolder(playlistDir)}
                title={t('playlistOpenFolder', lang)}
              >
                <FolderOpen size={12} />
                <span>{t('playlistOpenFolder', lang)}</span>
              </button>
            )}
          </div>

          {/* Drawer Units List */}
          <div className="playlist-units-list">
            {filteredEntries.length === 0 ? (
              <div className="playlist-units-empty">
                <span>{t('unitNoMatches', lang)}</span>
              </div>
            ) : (
              filteredEntries.map((unit, uIdx) => {
                const isUnitActive = unit.status === 'downloading'
                const isUnitDone = unit.status === 'completed'
                const isUnitError = unit.status === 'error'
                const unitUrl = unit.url || (unit.id ? `https://www.youtube.com/watch?v=${unit.id}` : null)

                return (
                  <div
                    key={unit.id || unit.index || uIdx}
                    className={`playlist-unit-row unit-status-${unit.status || 'pending'} ${unit.filePath ? 'has-file' : ''}`}
                  >
                    {/* Index */}
                    <span className="unit-index">
                      #{String(unit.index || uIdx + 1).padStart(2, '0')}
                    </span>

                    {/* Status indicator */}
                    <div className="unit-status-indicator">
                      {isUnitDone ? (
                        <span className="unit-badge done" title={t('unitStatusCompleted', lang)}>
                          <Check size={11} />
                        </span>
                      ) : isUnitActive ? (
                        <div className="unit-badge downloading" title={t('unitStatusDownloading', lang)}>
                          <Loader2 size={11} className="spin" />
                          {unit.progress ? <span className="unit-pct">{Math.round(unit.progress)}%</span> : null}
                        </div>
                      ) : isUnitError ? (
                        <span className="unit-badge error" title={t('unitStatusError', lang)}>
                          <AlertCircle size={11} />
                        </span>
                      ) : (
                        <span className="unit-badge pending" title={t('unitStatusPending', lang)}>
                          <span className="unit-dot" />
                        </span>
                      )}
                    </div>

                    {/* Title and Uploader */}
                    <div className="unit-content">
                      <span
                        className={`unit-title ${isUnitDone && unit.filePath ? 'clickable' : ''}`}
                        title={unit.title}
                        onClick={() => {
                          if (isUnitDone && unit.filePath) {
                            window.api.openFile(unit.filePath)
                          }
                        }}
                      >
                        {unit.title || `Track ${unit.index || uIdx + 1}`}
                      </span>
                      {unit.uploader && (
                        <span className="unit-uploader-name">{unit.uploader}</span>
                      )}
                    </div>

                    {/* Duration */}
                    {unit.duration ? (
                      <span className="unit-duration">
                        {formatDuration(unit.duration)}
                      </span>
                    ) : null}

                    {/* Unit actions */}
                    <div className="unit-actions">
                      {isUnitDone && unit.filePath && (
                        <>
                          <button
                            type="button"
                            className="unit-action-btn"
                            title={t('unitPlay', lang)}
                            onClick={(e) => {
                              e.stopPropagation()
                              window.api.openFile(unit.filePath)
                            }}
                          >
                            <Play size={12} />
                          </button>
                          <button
                            type="button"
                            className="unit-action-btn"
                            title={t('unitShowInFolder', lang)}
                            onClick={(e) => {
                              e.stopPropagation()
                              window.api.showInFolder(unit.filePath)
                            }}
                          >
                            <FolderOpen size={12} />
                          </button>
                        </>
                      )}
                      {unitUrl && (
                        <button
                          type="button"
                          className="unit-action-btn"
                          title={t('unitOpenUrl', lang)}
                          onClick={(e) => {
                            e.stopPropagation()
                            window.api.openExternal(unitUrl)
                          }}
                        >
                          <ExternalLink size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

