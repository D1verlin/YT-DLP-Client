import { useState, useMemo } from 'react'
import {
  Clock,
  User,
  Download,
  ArrowLeft,
  Video,
  Music,
  Eye,
  ThumbsUp,
  Calendar,
  Layers,
  HardDrive,
  Film,
  Tag,
  ListVideo,
  CheckSquare,
  Square,
  Check,
  Scissors,
  FileText,
  Disc
} from 'lucide-react'
import CustomSelect from './CustomSelect'
import useStore from '../store/useStore'
import { t } from '../utils/i18n'

function formatViews(n, lang = 'ru') {
  if (!n) return null
  const word = t('viewsWord', lang)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M ${word}`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K ${word}`
  return `${n} ${word}`
}

function formatLikes(n) {
  if (!n) return null
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`
  return `${n}`
}

function formatBytes(bytes) {
  if (!bytes) return null
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `~${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}

function fmtDuration(sec) {
  if (!sec) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  return h
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

export default function ConfigCard({ info, onAdd, onCancel }) {
  const language = useStore((s) => s.language)
  const [format, setFormat] = useState('video')
  const [quality, setQuality] = useState(info.videoQualities?.[0]?.value || 'best')
  const [videoCodec, setVideoCodec] = useState('default')
  const [audioBitrate, setAudioBitrate] = useState('320k')
  const [subtitles, setSubtitles] = useState('none')
  const [isTrimming, setIsTrimming] = useState(false)
  const [trimStart, setTrimStart] = useState('00:00')
  const [trimEnd, setTrimEnd] = useState(info.duration ? fmtDuration(info.duration) : '')
  const isPlaylist = Boolean(info.isPlaylist)

  // Playlist item selections (array of 1-based indices)
  const allEntries = useMemo(() => info.entries || [], [info.entries])
  const [selectedIndices, setSelectedIndices] = useState(() =>
    allEntries.map((e) => e.index)
  )
  const [showPlaylistEntries, setShowPlaylistEntries] = useState(isPlaylist)

  const toggleSelectAll = () => {
    if (selectedIndices.length === allEntries.length) {
      setSelectedIndices([])
    } else {
      setSelectedIndices(allEntries.map((e) => e.index))
    }
  }

  const toggleIndex = (idx) => {
    setSelectedIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx].sort((a, b) => a - b)
    )
  }

  const formatOptions = [
    { value: 'video', label: isPlaylist ? t('optVideoPlaylist', language) : t('optVideoSingle', language) },
    ...(info.hasAudio ? [{ value: 'audio', label: isPlaylist ? t('optAudioPlaylist', language) : t('optAudioSingle', language) }] : [])
  ]

  const qualityOptions = useMemo(() => {
    const list = [{ value: 'best', label: t('qualityBest', language) }]
    const seen = new Set(['best'])

    for (const q of info.videoQualities || []) {
      if (!seen.has(q.value)) {
        seen.add(q.value)
        list.push({
          value: q.value,
          label: q.label || `${q.value}p`
        })
      }
    }
    return list
  }, [info.videoQualities, language])

  const codecOptions = [
    { value: 'default', label: t('codecAuto', language) },
    { value: 'h264', label: t('codecH264', language) },
    { value: 'av1', label: t('codecAV1', language) }
  ]

  const bitrateOptions = [
    { value: '320k', label: '320 kbps (Max)' },
    { value: '256k', label: '256 kbps' },
    { value: '192k', label: '192 kbps' },
    { value: '128k', label: '128 kbps' }
  ]

  const subtitleOptions = [
    { value: 'none', label: t('subsNone', language) },
    { value: 'ru', label: t('subsRu', language) },
    { value: 'en', label: t('subsEn', language) },
    { value: 'all', label: t('subsAll', language) }
  ]

  const viewCountStr = formatViews(info.viewCount, language)
  const likeCountStr = formatLikes(info.likeCount)
  const sizeStr = formatBytes(info.filesizeApprox)

  const handleDownloadClick = () => {
    let timeRange = null
    if (isTrimming && trimStart.trim() && trimEnd.trim()) {
      timeRange = `*${trimStart.trim()}-${trimEnd.trim()}`
    }

    const baseConfig = {
      format,
      quality,
      videoCodec: format === 'video' ? videoCodec : undefined,
      audioBitrate: format === 'audio' ? audioBitrate : undefined,
      subtitles: subtitles !== 'none' ? subtitles : undefined,
      timeRange
    }

    if (isPlaylist) {
      const itemsParam =
        selectedIndices.length === allEntries.length || selectedIndices.length === 0
          ? null
          : selectedIndices.join(',')

      const selectedSet = new Set(selectedIndices.map(Number))
      const chosen = (allEntries && allEntries.length > 0)
        ? allEntries.filter((e) => selectedSet.size === 0 || selectedSet.has(Number(e.index)))
        : []

      const entries = chosen.map((e) => ({
        index: e.index,
        id: e.id,
        title: e.title,
        duration: e.duration,
        uploader: e.uploader,
        url: e.url || (e.id ? `https://www.youtube.com/watch?v=${e.id}` : null),
        status: 'pending',
        progress: 0,
        filePath: null
      }))

      onAdd({
        ...baseConfig,
        isPlaylist: true,
        playlistItems: itemsParam,
        entries
      })
    } else {
      onAdd({
        ...baseConfig,
        isPlaylist: false
      })
    }
  }

  return (
    <div className="config-card-seamless">
      {/* ── TOP HEADER / NAVIGATION ─────────────────────────── */}
      <div className="config-nav-header">
        <button
          type="button"
          className="config-back-btn"
          onClick={onCancel}
          title={t('tipChangeUrl', language)}
        >
          <ArrowLeft size={15} />
          <span>{t('changeUrl', language)}</span>
        </button>

        <div className="config-header-badges">
          {info.platform && (
            <span className="config-platform-pill">
              {info.platform}
            </span>
          )}
          <span className="config-status-badge">
            {isPlaylist ? <ListVideo size={13} /> : <Film size={13} />}
            <span>
              {isPlaylist
                ? t('playlistBadgeCount', language, { count: info.playlistCount })
                : t('readyToDownload', language)}
            </span>
          </span>
        </div>
      </div>

      {/* ── MAIN MEDIA SHOWCASE ─────────────────────────────── */}
      <div className="config-media-box">
        {/* Left: 16:9 Thumbnail with Overlay */}
        <div className="config-thumb-container">
          <div className="config-thumb-wrap">
            {info.thumbnail ? (
              <img src={info.thumbnail} alt="" className="config-video-thumb" />
            ) : (
              <div className="config-thumb-placeholder">{t('noThumbnail', language)}</div>
            )}
            {info.duration ? (
              <div className="config-duration-badge">
                <Clock size={11} />
                <span>{fmtDuration(info.duration)}</span>
              </div>
            ) : null}
            {isPlaylist && (
              <div className="config-playlist-overlay">
                <Layers size={13} />
                <span>{t('videosCount', language, { count: info.playlistCount })}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Comprehensive Info Block */}
        <div className="config-info-content">
          <h1 className="config-title-text" title={info.title}>
            {info.title || (isPlaylist ? t('playlistDefaultTitle', language) : t('videoDefaultTitle', language))}
          </h1>

          {/* Author / Channel */}
          {info.uploader && (
            <div className="config-author-row">
              <div className="config-author-chip">
                <User size={13} className="text-sec" />
                <span className="config-author-name">{info.uploader}</span>
              </div>
            </div>
          )}

          {/* Metadata Chips Grid */}
          <div className="config-meta-grid">
            {viewCountStr && (
              <div className="config-meta-item" title={t('viewsTooltip', language)}>
                <Eye size={13} />
                <span>{viewCountStr}</span>
              </div>
            )}
            {likeCountStr && (
              <div className="config-meta-item" title={t('likesTooltip', language)}>
                <ThumbsUp size={13} />
                <span>{t('likesCount', language, { count: likeCountStr })}</span>
              </div>
            )}
            {info.uploadDate && (
              <div className="config-meta-item" title={t('uploadDateTooltip', language)}>
                <Calendar size={13} />
                <span>{info.uploadDate}</span>
              </div>
            )}
            {info.fps && (
              <div className="config-meta-item" title={t('fpsTooltip', language)}>
                <Film size={13} />
                <span>{info.fps} FPS</span>
              </div>
            )}
            {sizeStr && (
              <div className="config-meta-item" title={t('filesizeTooltip', language)}>
                <HardDrive size={13} />
                <span>{sizeStr}</span>
              </div>
            )}
          </div>

          {/* Tags */}
          {info.tags && info.tags.length > 0 && (
            <div className="config-tags-list">
              <Tag size={12} className="text-sec" />
              {info.tags.map((tItem, i) => (
                <span key={i} className="config-mini-tag">
                  #{tItem}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── PLAYLIST TRACKLIST & SELECTION (IF PLAYLIST) ─────── */}
      {isPlaylist && allEntries.length > 0 && (
        <div className="config-playlist-section">
          <div className="config-playlist-header-row">
            <button
              type="button"
              className="config-playlist-toggle"
              onClick={() => setShowPlaylistEntries(!showPlaylistEntries)}
            >
              <ListVideo size={14} />
              <span>
                {showPlaylistEntries ? t('hidePlaylistList', language) : t('showPlaylistList', language)}
              </span>
              <span className="config-playlist-count-pill">
                {t('selectedPlaylistCount', language, { selected: selectedIndices.length, total: allEntries.length })}
              </span>
            </button>

            <button
              type="button"
              className="config-playlist-select-all-btn"
              onClick={toggleSelectAll}
            >
              {selectedIndices.length === allEntries.length ? (
                <>
                  <CheckSquare size={13} />
                  <span>{t('unselectAll', language)}</span>
                </>
              ) : (
                <>
                  <Square size={13} />
                  <span>{t('selectAll', language)}</span>
                </>
              )}
            </button>
          </div>

          {showPlaylistEntries && (
            <div className="config-playlist-list">
              {allEntries.map((item) => {
                const isSelected = selectedIndices.includes(item.index)
                return (
                  <div
                    key={item.index}
                    className={`config-playlist-item ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => toggleIndex(item.index)}
                  >
                    <div className="config-playlist-check-box">
                      {isSelected && <Check size={11} />}
                    </div>
                    <span className="config-playlist-num">{item.index}.</span>
                    <span className="config-playlist-title" title={item.title}>
                      {item.title}
                    </span>
                    {item.duration ? (
                      <span className="config-playlist-dur">{fmtDuration(item.duration)}</span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TIME TRIMMING SECTION (SINGLE MEDIA) ─────────────── */}
      {!isPlaylist && (
        <div className="config-trim-section" style={{ margin: '0 20px 14px', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={isTrimming}
                onChange={(e) => setIsTrimming(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: '#ffffff' }}
              />
              <Scissors size={14} className="text-sec" />
              <span>{t('trimSectionTitle', language)}</span>
            </label>
            {isTrimming && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('trimFrom', language)}:</span>
                  <input
                    type="text"
                    value={trimStart}
                    onChange={(e) => setTrimStart(e.target.value)}
                    placeholder="00:00"
                    className="input input-sm font-mono"
                    style={{ width: 76, textAlign: 'center', padding: '4px 6px', fontSize: 12 }}
                  />
                </div>
                <span style={{ color: 'var(--text-secondary)' }}>—</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('trimTo', language)}:</span>
                  <input
                    type="text"
                    value={trimEnd}
                    onChange={(e) => setTrimEnd(e.target.value)}
                    placeholder={fmtDuration(info.duration) || "00:00"}
                    className="input input-sm font-mono"
                    style={{ width: 76, textAlign: 'center', padding: '4px 6px', fontSize: 12 }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CONFIGURATION & ACTION BAR ──────────────────────── */}
      <div className="config-action-strip">
        <div className="config-selects-row" style={{ flexWrap: 'wrap' }}>
          <div className="config-select-col">
            <label className="config-field-label">{t('fieldFormat', language)}</label>
            <CustomSelect
              value={format}
              onChange={setFormat}
              options={formatOptions}
              icon={format === 'video' ? Video : Music}
            />
          </div>

          {format === 'video' && (
            <div className="config-select-col">
              <label className="config-field-label">{t('fieldQuality', language)}</label>
              <CustomSelect
                value={quality}
                onChange={setQuality}
                options={qualityOptions}
              />
            </div>
          )}

          {format === 'video' && (
            <div className="config-select-col">
              <label className="config-field-label">{t('fieldVideoCodec', language)}</label>
              <CustomSelect
                value={videoCodec}
                onChange={setVideoCodec}
                options={codecOptions}
                icon={Film}
              />
            </div>
          )}

          {format === 'audio' && (
            <div className="config-select-col">
              <label className="config-field-label">{t('fieldAudioBitrate', language)}</label>
              <CustomSelect
                value={audioBitrate}
                onChange={setAudioBitrate}
                options={bitrateOptions}
                icon={Disc}
              />
            </div>
          )}

          {format === 'video' && (
            <div className="config-select-col">
              <label className="config-field-label">{t('fieldSubtitles', language)}</label>
              <CustomSelect
                value={subtitles}
                onChange={setSubtitles}
                options={subtitleOptions}
                icon={FileText}
              />
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn btn-primary config-main-download-btn"
          onClick={handleDownloadClick}
          disabled={isPlaylist && selectedIndices.length === 0}
        >
          <Download size={18} />
          <span>
            {isPlaylist
              ? selectedIndices.length === allEntries.length
                ? t('btnDownloadAllPlaylist', language, { count: allEntries.length })
                : t('btnDownloadSelectedPlaylist', language, { selected: selectedIndices.length, total: allEntries.length })
              : format === 'video'
                ? t('btnDownloadVideo', language)
                : t('btnDownloadAudio', language)}
          </span>
        </button>
      </div>
    </div>
  )
}
