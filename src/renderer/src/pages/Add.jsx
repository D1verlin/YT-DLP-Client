import { useState, useEffect, useMemo } from 'react'
import {
  Link as LinkIcon,
  Clipboard,
  Sparkles,
  Loader2,
  X,
  ListPlus,
  Download,
  Trash2,
  Video,
  Music,
  Film,
  Disc,
  FileText
} from 'lucide-react'
import FluidWaveform from '../components/FluidWaveform'
import ConfigCard from '../components/ConfigCard'
import CustomSelect from '../components/CustomSelect'
import useStore from '../store/useStore'
import { t } from '../utils/i18n'

const SUPPORTED_SITES = ['YouTube', 'Rutube', 'VK Video', 'TikTok', 'Twitch', 'SoundCloud', 'Vimeo']

function extractUrlsFromText(text) {
  if (!text) return []
  const lines = text.split(/\r?\n/)
  const urls = []
  const seen = new Set()

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    let candidate = null
    const urlMatch = line.match(/https?:\/\/[^\s"'<>]+/i)
    if (urlMatch) {
      candidate = urlMatch[0]
    } else {
      const domainMatch = line.match(/(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s"'<>]*)?/i)
      if (domainMatch) {
        candidate = 'https://' + domainMatch[0]
      }
    }

    if (candidate) {
      try {
        candidate = candidate.replace(/[.,;]+$/, '')
        const parsed = new URL(candidate)
        if (parsed.hostname && parsed.hostname.includes('.')) {
          if (!seen.has(candidate)) {
            seen.add(candidate)
            urls.push(candidate)
          }
        }
      } catch {
        // Invalid URL, skip
      }
    }
  }

  return urls
}

function formatBatchCount(count, lang) {
  if (lang === 'ru') {
    const mod10 = count % 10
    const mod100 = count % 100
    if (mod10 === 1 && mod100 !== 11) {
      return t('batchDetectedSingular', lang, { count })
    }
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
      return t('batchDetectedFew', lang, { count })
    }
    return t('batchDetectedCount', lang, { count })
  }
  return count === 1
    ? t('batchDetectedSingular', lang, { count })
    : t('batchDetectedCount', lang, { count })
}

export default function AddPage({ onNav }) {
  const language = useStore((s) => s.language)
  const pendingUrl = useStore((s) => s.pendingUrl)
  const setPendingUrl = useStore((s) => s.setPendingUrl)

  // Mode: 'single' | 'batch'
  const [mode, setMode] = useState('single')

  // Single mode states
  const [url, setUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [info, setInfo] = useState(null)
  const [analyzeErr, setAnalyzeErr] = useState(null)

  // Batch mode states
  const [batchText, setBatchText] = useState('')
  const [batchSubmitting, setBatchSubmitting] = useState(false)
  const [batchFormat, setBatchFormat] = useState('video')
  const [batchQuality, setBatchQuality] = useState('best')
  const [batchVideoCodec, setBatchVideoCodec] = useState('default')
  const [batchAudioBitrate, setBatchAudioBitrate] = useState('320k')
  const [batchSubtitles, setBatchSubtitles] = useState('none')
  const [batchAllowPlaylists, setBatchAllowPlaylists] = useState(false)

  const validUrls = useMemo(() => extractUrlsFromText(batchText), [batchText])

  useEffect(() => {
    if (pendingUrl) {
      setMode('single')
      setInfo(null)
      setAnalyzeErr(null)
      setUrl(pendingUrl)
      analyze(pendingUrl)
      setPendingUrl(null)
    }
  }, [pendingUrl])

  const analyze = async (targetUrl) => {
    const query = (targetUrl || url).trim()
    if (!query || analyzing) return
    setAnalyzing(true)
    setAnalyzeErr(null)

    try {
      const res = await window.api.analyzeUrl(query)
      setAnalyzing(false)

      if (res.success) {
        setInfo({ ...res.data, url: query })
      } else {
        setAnalyzeErr(res.error || t('errorParse', language))
      }
    } catch (err) {
      setAnalyzing(false)
      setAnalyzeErr(err.message || t('errorParse', language))
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text && text.trim()) {
        const trimmed = text.trim()
        setUrl(trimmed)
        analyze(trimmed)
      }
    } catch {
      // If clipboard read fails
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter') analyze()
  }

  const handleCancel = () => {
    setAnalyzing(false)
    setInfo(null)
    setAnalyzeErr(null)
  }

  const handleAdd = async (config) => {
    const res = await window.api.startDownload({
      url: info.url,
      title: info.title,
      thumbnail: info.thumbnail,
      duration: info.duration,
      config,
      entries: config.entries || info.entries || []
    })
    if (res.success) {
      setInfo(null)
      setUrl('')
      if (onNav) {
        onNav('queue')
      }
    }
  }

  // Batch action handlers
  const handleBatchPaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text && text.trim()) {
        setBatchText((prev) => (prev ? prev.trimEnd() + '\n' + text.trim() : text.trim()))
      }
    } catch {}
  }

  const handleBatchClear = () => {
    setBatchText('')
  }

  const handleStartBatchDownload = async () => {
    if (validUrls.length === 0 || batchSubmitting) return
    setBatchSubmitting(true)

    const config = {
      format: batchFormat,
      quality: batchQuality,
      videoCodec: batchFormat === 'video' ? batchVideoCodec : undefined,
      audioBitrate: batchFormat === 'audio' ? batchAudioBitrate : undefined,
      subtitles: batchSubtitles !== 'none' ? batchSubtitles : undefined,
      allowPlaylists: batchAllowPlaylists,
      isPlaylist: false
    }

    const items = validUrls.map((targetUrl) => ({
      url: targetUrl,
      title: targetUrl,
      thumbnail: null,
      duration: null,
      config
    }))

    try {
      if (window.api.startBatchDownload) {
        await window.api.startBatchDownload(items)
      } else {
        for (const item of items) {
          await window.api.startDownload(item)
        }
      }
      setBatchText('')
      setBatchSubmitting(false)
      if (onNav) {
        onNav('queue')
      }
    } catch (err) {
      console.error('Batch download failed:', err)
      setBatchSubmitting(false)
    }
  }

  // Select options for batch settings
  const formatOptions = [
    { value: 'video', label: t('formatVideo', language) },
    { value: 'audio', label: t('formatAudio', language) }
  ]

  const qualityOptions = [
    { value: 'best', label: t('qualityBest', language) },
    { value: '2160', label: '4K (2160p)' },
    { value: '1440', label: '2K (1440p)' },
    { value: '1080', label: '1080p Full HD' },
    { value: '720', label: '720p HD' },
    { value: '480', label: '480p SD' }
  ]

  const codecOptions = [
    { value: 'default', label: language === 'ru' ? 'Авто (Лучшее качество)' : 'Auto (Best Quality)' },
    { value: 'h264', label: language === 'ru' ? 'H.264 / AVC (Совместимость)' : 'H.264 / AVC (Compatibility)' },
    { value: 'av1', label: language === 'ru' ? 'AV1 / VP9 (Высокое сжатие)' : 'AV1 / VP9 (High Compression)' }
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

  return (
    <div className="add-page-container">

      {/* ── STAGE 1 & 2: SEARCH & ANALYZING (STABLE ZERO-JUMP LAYOUT) ── */}
      {!info && (
        <div className="add-page-content">
          {/* Fluid Canvas Waveform Visual */}
          <div className="add-wave-wrapper">
            <FluidWaveform analyzing={analyzing} />
          </div>

          <div className="add-hero-brand">
            <h1 className="add-hero-title">{t('addHeroTitle', language)}</h1>
          </div>

          <p className="add-hero-subtitle">
            {mode === 'batch' ? t('batchHeroSub', language) : t('addHeroSub', language)}
          </p>

          {/* Mode Switcher Toggle with Sliding Pill */}
          <div className="add-mode-toggle-wrap">
            <div className="add-mode-toggle">
              <div
                className="add-mode-indicator"
                style={{
                  transform: mode === 'single' ? 'translateX(0%)' : 'translateX(100%)'
                }}
              />
              <button
                type="button"
                className={`add-mode-btn ${mode === 'single' ? 'active' : ''}`}
                onClick={() => setMode('single')}
              >
                <LinkIcon size={14} />
                <span>{t('modeSingle', language)}</span>
              </button>
              <button
                type="button"
                className={`add-mode-btn ${mode === 'batch' ? 'active' : ''}`}
                onClick={() => setMode('batch')}
              >
                <ListPlus size={14} />
                <span>{t('modeBatch', language)}</span>
              </button>
            </div>
          </div>

          {/* Animated Viewport for Smooth State Transition */}
          <div className="add-panels-viewport">
            <div key={mode} className="add-panel-animated">
              {/* MODE: SINGLE LINK INPUT */}
              {mode === 'single' && (
                <div className="add-input-card">
                  <div className="add-input-row">
                    <div className="add-input-wrapper">
                      <LinkIcon size={18} className="add-input-icon" />
                      <input
                        id="url-input"
                        className="add-input"
                        placeholder={t('urlPlaceholder', language)}
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={handleKey}
                        disabled={analyzing}
                        autoFocus
                      />
                      {url ? (
                        <button
                          type="button"
                          className="add-clear-btn"
                          title={t('btnClearInput', language)}
                          onClick={() => setUrl('')}
                          disabled={analyzing}
                        >
                          <X size={14} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="add-paste-btn"
                          title={t('btnPaste', language)}
                          onClick={handlePaste}
                          disabled={analyzing}
                        >
                          <Clipboard size={14} />
                          <span>{t('btnPaste', language)}</span>
                        </button>
                      )}
                    </div>

                    <button
                      id="analyze-btn"
                      className="btn btn-primary add-analyze-btn"
                      onClick={() => analyze()}
                      disabled={analyzing || !url.trim()}
                    >
                      {analyzing ? (
                        <>
                          <Loader2 size={16} className="spin" />
                          <span>{t('btnAnalyzing', language)}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          <span>{t('btnAnalyze', language)}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Analyzing Live Status Pill (appears inside without shifting container height) */}
                  {analyzing && (
                    <div className="add-live-status-row">
                      <div className="add-live-status-pill">
                        <Loader2 size={13} className="spin" />
                        <span>{t('analyzingMsg', language)}</span>
                      </div>
                      <button
                        type="button"
                        className="add-cancel-tiny-btn"
                        onClick={handleCancel}
                      >
                        <X size={13} />
                        <span>{t('btnCancel', language)}</span>
                      </button>
                    </div>
                  )}

                  {analyzeErr && <div className="analyze-error">{analyzeErr}</div>}
                </div>
              )}

              {/* MODE: BATCH MULTIPLE LINKS INPUT */}
              {mode === 'batch' && (
                <div className="batch-input-card">
                  {/* Header / Actions toolbar */}
                  <div className="batch-card-header">
                    <div className="batch-counter-wrap">
                      <span className={`batch-counter-badge ${validUrls.length > 0 ? 'has-links' : ''}`}>
                        {formatBatchCount(validUrls.length, language)}
                      </span>
                    </div>
                    <div className="batch-actions-group">
                      <button
                        type="button"
                        className="batch-tool-btn"
                        onClick={handleBatchPaste}
                        title={t('batchPaste', language)}
                        disabled={batchSubmitting}
                      >
                        <Clipboard size={13} />
                        <span>{t('batchPaste', language)}</span>
                      </button>
                      {batchText && (
                        <button
                          type="button"
                          className="batch-tool-btn danger"
                          onClick={handleBatchClear}
                          title={t('batchClear', language)}
                          disabled={batchSubmitting}
                        >
                          <Trash2 size={13} />
                          <span>{t('batchClear', language)}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Textarea for links */}
                  <div className="batch-textarea-wrapper">
                    <textarea
                      className="batch-textarea"
                      placeholder={t('batchPlaceholder', language)}
                      value={batchText}
                      onChange={(e) => setBatchText(e.target.value)}
                      disabled={batchSubmitting}
                      rows={6}
                      autoFocus
                      spellCheck={false}
                    />
                  </div>

                  {/* Batch Configuration Strip with 2-Column Responsive Grid */}
                  <div className="batch-config-strip">
                    <div className="batch-config-grid">
                      <div className="batch-select-col">
                        <label className="batch-field-label">{t('fieldFormat', language)}</label>
                        <CustomSelect
                          value={batchFormat}
                          onChange={setBatchFormat}
                          options={formatOptions}
                          icon={batchFormat === 'video' ? Video : Music}
                        />
                      </div>

                      {batchFormat === 'video' && (
                        <div className="batch-select-col">
                          <label className="batch-field-label">{t('fieldQuality', language)}</label>
                          <CustomSelect
                            value={batchQuality}
                            onChange={setBatchQuality}
                            options={qualityOptions}
                          />
                        </div>
                      )}

                      {batchFormat === 'video' && (
                        <div className="batch-select-col">
                          <label className="batch-field-label">{t('fieldVideoCodec', language)}</label>
                          <CustomSelect
                            value={batchVideoCodec}
                            onChange={setBatchVideoCodec}
                            options={codecOptions}
                            icon={Film}
                          />
                        </div>
                      )}

                      {batchFormat === 'audio' && (
                        <div className="batch-select-col">
                          <label className="batch-field-label">{t('fieldAudioBitrate', language)}</label>
                          <CustomSelect
                            value={batchAudioBitrate}
                            onChange={setBatchAudioBitrate}
                            options={bitrateOptions}
                            icon={Disc}
                          />
                        </div>
                      )}

                      {batchFormat === 'video' && (
                        <div className="batch-select-col">
                          <label className="batch-field-label">{t('fieldSubtitles', language)}</label>
                          <CustomSelect
                            value={batchSubtitles}
                            onChange={setBatchSubtitles}
                            options={subtitleOptions}
                            icon={FileText}
                          />
                        </div>
                      )}
                    </div>

                    {/* Batch Action Row */}
                    <div className="batch-submit-row">
                      <button
                        type="button"
                        className="btn btn-primary batch-download-btn"
                        onClick={handleStartBatchDownload}
                        disabled={validUrls.length === 0 || batchSubmitting}
                      >
                        {batchSubmitting ? (
                          <>
                            <Loader2 size={16} className="spin" />
                            <span>{t('batchAddingTasks', language)}</span>
                          </>
                        ) : (
                          <>
                            <Download size={16} />
                            <span>{t('batchDownloadBtn', language, { count: validUrls.length })}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Supported services tags */}
          <div className="add-supported-row">
            <span className="add-supported-label">{t('supportedLabel', language)}</span>
            <div className="add-tags">
              {SUPPORTED_SITES.map((site) => (
                <span key={site} className="add-site-tag">
                  {site}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE 3: RICH VIDEO & PLAYLIST CONFIGURATION ─────────────── */}
      {info && (
        <div className="add-config-stage">
          <ConfigCard
            info={info}
            onAdd={handleAdd}
            onCancel={handleCancel}
          />
        </div>
      )}
    </div>
  )
}
