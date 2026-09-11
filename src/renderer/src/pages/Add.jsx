import { useState, useEffect } from 'react'
import { Link as LinkIcon, Clipboard, Sparkles, Loader2, X } from 'lucide-react'
import FluidWaveform from '../components/FluidWaveform'
import ConfigCard from '../components/ConfigCard'
import useStore from '../store/useStore'
import { t } from '../utils/i18n'

const SUPPORTED_SITES = ['YouTube', 'Rutube', 'VK Video', 'TikTok', 'Twitch', 'SoundCloud', 'Vimeo']

export default function AddPage({ onNav }) {
  const language = useStore((s) => s.language)
  const pendingUrl = useStore((s) => s.pendingUrl)
  const setPendingUrl = useStore((s) => s.setPendingUrl)

  const [url, setUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [info, setInfo] = useState(null)
  const [analyzeErr, setAnalyzeErr] = useState(null)

  useEffect(() => {
    if (pendingUrl) {
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
            {t('addHeroSub', language)}
          </p>

          {/* Input Bar */}
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
