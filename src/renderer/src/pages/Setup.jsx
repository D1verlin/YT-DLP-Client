import { useState, useEffect } from 'react'
import useStore from '../store/useStore'
import { t } from '../utils/i18n'
import logoSvg from '../assets/logo.svg'

const TOTAL_STEPS = 4

export default function SetupPage({ onComplete }) {
  const language = useStore((state) => state.language)
  const setLanguage = useStore((state) => state.setLanguage)

  const [currentStep, setCurrentStep] = useState(1) // 1: Lang, 2: Folder, 3: Engine, 4: Ready
  const [settings, setSettings] = useState({
    downloadPath: '',
    language: language || 'en'
  })

  const [binaryInfo, setBinaryInfo] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadMessage, setDownloadMessage] = useState('')
  const [downloadError, setDownloadError] = useState(null)
  const [downloadSuccess, setDownloadSuccess] = useState(false)

  useEffect(() => {
    window.api.getSettings?.().then((cfg) => {
      if (cfg) {
        setSettings(cfg)
        if (cfg.language) {
          setLanguage(cfg.language)
        }
      }
    })

    loadBinaryInfo()

    const unsubProgress = window.api.onBinaryProgress?.((data) => {
      if (data) {
        if (data.percent !== undefined) setDownloadProgress(data.percent)
        if (data.message) setDownloadMessage(data.message)
      }
    })

    return () => {
      unsubProgress?.()
    }
  }, [])

  const loadBinaryInfo = async (force = false) => {
    try {
      const info = await window.api.getBinaryInfo?.(force)
      setBinaryInfo(info)
    } catch (e) {
      console.error('Failed to get binary info:', e)
    }
  }

  const handleLanguageSelect = async (newLang) => {
    setLanguage(newLang)
    setSettings((prev) => ({ ...prev, language: newLang }))
    try {
      await window.api.saveSettings?.({ ...settings, language: newLang })
    } catch (e) {
      console.error('Failed to save language:', e)
    }
  }

  const handleSelectFolder = async () => {
    try {
      const folder = await window.api.selectFolder?.()
      if (folder) {
        const updated = { ...settings, downloadPath: folder }
        setSettings(updated)
        await window.api.saveSettings?.(updated)
      }
    } catch (e) {
      console.error('Failed to select folder:', e)
    }
  }

  const handleDownloadBinaries = async () => {
    setDownloading(true)
    setDownloadError(null)
    setDownloadSuccess(false)
    setDownloadProgress(5)
    setDownloadMessage(t('setupDownloadingBinaries', language))

    try {
      const res = await window.api.downloadBinaries?.()
      if (res?.success) {
        setDownloadSuccess(true)
        setDownloadProgress(100)
        await loadBinaryInfo(true)
      } else {
        setDownloadError(res?.error || 'Download failed')
      }
    } catch (e) {
      setDownloadError(e.message || 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  const handleSelectYtDlpFile = async () => {
    try {
      const file = await window.api.selectFile?.([
        { name: 'yt-dlp Executable', extensions: ['exe', ''] },
        { name: 'All Files', extensions: ['*'] }
      ])
      if (file) {
        await window.api.setCustomYtDlp?.(file)
        setDownloadError(null)
        await loadBinaryInfo(true)
      }
    } catch (e) {
      console.error('Failed to select yt-dlp file:', e)
    }
  }

  const handleSelectFfmpegFile = async () => {
    try {
      const file = await window.api.selectFile?.([
        { name: 'FFmpeg Executable', extensions: ['exe', ''] },
        { name: 'All Files', extensions: ['*'] }
      ])
      if (file) {
        await window.api.setCustomFfmpeg?.(file)
        await loadBinaryInfo(true)
      }
    } catch (e) {
      console.error('Failed to select FFmpeg file:', e)
    }
  }

  const handleComplete = async () => {
    try {
      await window.api.saveSettings?.(settings)
      await window.api.completeSetup?.()
    } catch (e) {
      console.error('Failed to complete setup:', e)
    }
    onComplete?.()
  }

  const ytdlpReady = !!(binaryInfo?.ytdlp?.installed || binaryInfo?.ytdlp?.exists)
  const ffmpegReady = !!(binaryInfo?.ffmpeg?.installed || binaryInfo?.ffmpeg?.exists)

  const stepsLabels = [
    t('setupStepLanguage', language),
    t('setupStepFolder', language),
    t('setupStepEngine', language),
    t('setupStepReady', language)
  ]

  return (
    <div className="setup-airy-viewport">
      <div className="setup-airy-container">
        {/* Top Stepper Indicator (Minimalist progress track) */}
        <div className="setup-stepper-track">
          <div className="setup-stepper-bars">
            {[1, 2, 3, 4].map((s) => (
              <button
                key={s}
                type="button"
                className={`setup-stepper-bar ${s === currentStep ? 'is-active' : s < currentStep ? 'is-passed' : ''}`}
                onClick={() => {
                  if (s < currentStep) setCurrentStep(s)
                }}
              />
            ))}
          </div>
          <div className="setup-stepper-meta">
            <span className="setup-step-count">{currentStep} / {TOTAL_STEPS}</span>
            <span className="setup-step-name">{stepsLabels[currentStep - 1]}</span>
          </div>
        </div>

        {/* ── STEP 1: LANGUAGE SELECTION (NO ICONS, NO EMOJIS, PURE TYPOGRAPHY) ── */}
        {currentStep === 1 && (
          <div className="setup-stage animate-fade">
            <div className="setup-stage-header">
              <img src={logoSvg} alt="YT-DLP" className="setup-airy-logo" />
              <h1 className="setup-stage-title">{t('setupWelcomeTitle', language)}</h1>
              <p className="setup-stage-desc">{t('setupLanguageSub', language)}</p>
            </div>

            <div className="setup-lang-group">
              <button
                type="button"
                className={`setup-lang-tile ${language === 'en' ? 'is-active' : ''}`}
                onClick={() => handleLanguageSelect('en')}
              >
                <div className="setup-lang-tile-content">
                  <span className="setup-lang-title">English</span>
                  <span className="setup-lang-badge">EN</span>
                </div>
                <div className="setup-lang-check-dot">
                  {language === 'en' && <div className="setup-check-inner" />}
                </div>
              </button>

              <button
                type="button"
                className={`setup-lang-tile ${language === 'ru' ? 'is-active' : ''}`}
                onClick={() => handleLanguageSelect('ru')}
              >
                <div className="setup-lang-tile-content">
                  <span className="setup-lang-title">Русский</span>
                  <span className="setup-lang-badge">RU</span>
                </div>
                <div className="setup-lang-check-dot">
                  {language === 'ru' && <div className="setup-check-inner" />}
                </div>
              </button>
            </div>

            <div className="setup-nav-row end">
              <button
                type="button"
                className="setup-btn-primary"
                onClick={() => setCurrentStep(2)}
              >
                <span>{t('btnNext', language)}</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: DOWNLOAD DIRECTORY ──────────────────────────────────────── */}
        {currentStep === 2 && (
          <div className="setup-stage animate-fade">
            <div className="setup-stage-header">
              <h1 className="setup-stage-title">{t('setupFolderTitle', language)}</h1>
              <p className="setup-stage-desc">{t('setupFolderSub', language)}</p>
            </div>

            <div className="setup-folder-block">
              <div className="setup-path-display">
                <span className="setup-path-text font-mono">
                  {settings.downloadPath || 'C:\\Users\\...\\Downloads'}
                </span>
                <button
                  type="button"
                  className="setup-btn-ghost"
                  onClick={handleSelectFolder}
                >
                  {t('btnBrowse', language)}
                </button>
              </div>
            </div>

            <div className="setup-nav-row">
              <button
                type="button"
                className="setup-btn-ghost"
                onClick={() => setCurrentStep(1)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                <span>{t('btnBack', language)}</span>
              </button>

              <button
                type="button"
                className="setup-btn-primary"
                onClick={() => setCurrentStep(3)}
              >
                <span>{t('btnNext', language)}</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: ENGINE & BINARIES ───────────────────────────────────────── */}
        {currentStep === 3 && (
          <div className="setup-stage animate-fade">
            <div className="setup-stage-header">
              <h1 className="setup-stage-title">{t('setupEngineTitle', language)}</h1>
              <p className="setup-stage-desc">{t('setupEngineSub', language)}</p>
            </div>

            <div className="setup-binaries-list">
              {/* yt-dlp */}
              <div className="setup-binary-row">
                <div className="setup-bin-col-info">
                  <span className="setup-bin-title">yt-dlp</span>
                  <span className="setup-bin-desc">{t('setupYtdlpDesc', language)}</span>
                </div>
                <div className="setup-bin-col-actions">
                  <div className="setup-bin-col-status">
                    {ytdlpReady ? (
                      <span className="setup-badge-clean success">
                        {binaryInfo?.ytdlp?.version ? `v${binaryInfo.ytdlp.version}` : 'Installed'}
                      </span>
                    ) : (
                      <span className="setup-badge-clean missing">
                        {t('versionNotFound', language)}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="setup-btn-row-action"
                    onClick={handleSelectYtDlpFile}
                    title={t('setupBtnBrowseManual', language)}
                  >
                    {t('btnBrowse', language)}
                  </button>
                </div>
              </div>

              {/* FFmpeg */}
              <div className="setup-binary-row">
                <div className="setup-bin-col-info">
                  <span className="setup-bin-title">FFmpeg</span>
                  <span className="setup-bin-desc">{t('setupFfmpegDesc', language)}</span>
                </div>
                <div className="setup-bin-col-actions">
                  <div className="setup-bin-col-status">
                    {ffmpegReady ? (
                      <span className="setup-badge-clean success">
                        {binaryInfo?.ffmpeg?.version ? `v${binaryInfo.ffmpeg.version}` : 'Installed'}
                      </span>
                    ) : (
                      <span className="setup-badge-clean muted">
                        Optional
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="setup-btn-row-action"
                    onClick={handleSelectFfmpegFile}
                    title={t('setupBtnBrowseManual', language)}
                  >
                    {t('btnBrowse', language)}
                  </button>
                </div>
              </div>
            </div>

            {/* Downloader Status */}
            {(!ytdlpReady || downloading || downloadSuccess || downloadError) && (
              <div className="setup-download-panel">
                {downloading && (
                  <div className="setup-download-status">
                    <div className="setup-progress-info-row">
                      <span className="setup-download-msg">{downloadMessage || t('setupDownloadingBinaries', language)}</span>
                      <span className="setup-download-val">{Math.round(downloadProgress)}%</span>
                    </div>
                    <div className="setup-flat-track">
                      <div
                        className="setup-flat-fill"
                        style={{ width: `${Math.max(5, Math.min(100, downloadProgress))}%` }}
                      />
                    </div>
                  </div>
                )}

                {downloadSuccess && (
                  <div className="setup-msg-line success">
                    {t('setupDownloadComplete', language)}
                  </div>
                )}

                {downloadError && (
                  <div className="setup-msg-line error">
                    {downloadError}
                  </div>
                )}

                {!downloading && !downloadSuccess && (
                  <div className="setup-download-btn-wrap">
                    <button
                      type="button"
                      className="setup-btn-outline"
                      onClick={handleDownloadBinaries}
                    >
                      {downloadError ? t('setupBtnRetry', language) : t('setupBtnDownloadBinaries', language)}
                    </button>
                    <button
                      type="button"
                      className="setup-btn-ghost-sm"
                      onClick={handleSelectYtDlpFile}
                    >
                      {t('setupBtnBrowseManual', language)}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="setup-nav-row">
              <button
                type="button"
                className="setup-btn-ghost"
                onClick={() => setCurrentStep(2)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                <span>{t('btnBack', language)}</span>
              </button>

              <button
                type="button"
                className="setup-btn-primary"
                onClick={() => setCurrentStep(4)}
              >
                <span>{t('btnNext', language)}</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: READY TO GO ─────────────────────────────────────────────── */}
        {currentStep === 4 && (
          <div className="setup-stage animate-fade">
            <div className="setup-stage-header">
              <h1 className="setup-stage-title">{t('setupReadyTitle', language)}</h1>
              <p className="setup-stage-desc">{t('setupReadySub', language)}</p>
            </div>

            <div className="setup-features-summary">
              <div className="setup-summary-row">
                <span className="setup-dot-marker" />
                <span className="setup-summary-text">{t('setupFeature1', language)}</span>
              </div>
              <div className="setup-summary-row">
                <span className="setup-dot-marker" />
                <span className="setup-summary-text">{t('setupFeature2', language)}</span>
              </div>
              <div className="setup-summary-row">
                <span className="setup-dot-marker" />
                <span className="setup-summary-text">{t('setupFeature3', language)}</span>
              </div>
              <div className="setup-summary-row">
                <span className="setup-dot-marker" />
                <span className="setup-summary-text">{t('setupFeature4', language)}</span>
              </div>
            </div>

            <div className="setup-nav-row">
              <button
                type="button"
                className="setup-btn-ghost"
                onClick={() => setCurrentStep(3)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                <span>{t('btnBack', language)}</span>
              </button>

              <button
                type="button"
                className="setup-btn-primary launch"
                onClick={handleComplete}
              >
                <span>{t('setupBtnLaunch', language)}</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
