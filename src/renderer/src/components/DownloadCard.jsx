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
  XCircle
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
    color: '#4caf50'
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

  const isPlaylist = Boolean(task.config?.isPlaylist || task.playlistTotal)
  const isAudioOnly = task.config?.format === 'audio'
  const isMerging = task.streamLabel === 'Объединение...' || task.streamLabel === 'Merging...'
  const isActive = task.status === 'downloading'

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
    const res = await window.api.showInFolder(task.filePath)
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
    <div className={`task-card-v2 status-${task.status}`}>
      {/* ── Left: Thumbnail / Poster ──────────────────────────────────── */}
      <div className="task-poster-wrap">
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
              {task.playlistTotal
                ? t('videosCount', lang, { count: task.playlistTotal })
                : task.config?.playlistItems
                  ? t('videosCount', lang, { count: String(task.config.playlistItems).split(',').length })
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

      {/* ── Center: Main Content & Progress ───────────────────────────── */}
      <div className="task-center-content">
        {/* Top row: Title + Badges */}
        <div className="task-header-row">
          <div className="task-title-group">
            <h3
              className="task-main-title"
              title={task.title || task.url}
              onClick={handleOpenFile}
            >
              {task.title || task.url}
            </h3>
            <div className="task-meta-chips">
              {/* Platform badge */}
              <span className={`task-chip platform ${platform.badgeCls}`}>
                <span className="chip-dot" style={{ background: platform.color }} />
                {platform.name}
              </span>

              {/* Quality / Format chip */}
              <span className="task-chip format">
                {isAudioOnly ? <Music size={11} /> : <Film size={11} />}
                {qualityText}
              </span>

              {/* Playlist progress chip */}
              {isPlaylist && task.playlistCurrent && task.playlistTotal && (
                <span className="task-chip playlist-prog">
                  <Layers size={11} />
                  {t('trackProgress', lang, { current: task.playlistCurrent, total: task.playlistTotal })}
                </span>
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

        {/* ── Active Progress Bar & Stats ─────────────────────────────── */}
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

        {/* ── Completed State Bar ────────────────────────────────────── */}
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

        {/* ── Error Notification ─────────────────────────────────────── */}
        {task.status === 'error' && task.errorMessage && (
          <div className="task-error-box">
            <AlertCircle size={14} className="error-box-icon" />
            <span className="error-box-text">{task.errorMessage}</span>
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

      {/* ── Right: Action Buttons Grid ───────────────────────────────── */}
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
  )
}


