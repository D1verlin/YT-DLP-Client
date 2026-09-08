import { useState, useEffect, useMemo } from 'react'
import {
  Save,
  FolderOpen,
  Globe,
  Sliders,
  Download,
  Film,
  Key,
  Cpu,
  Info,
  Music,
  RotateCcw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Layers,
  FileCode,
  RefreshCw
} from 'lucide-react'
import CustomSelect from '../components/CustomSelect'
import logoSvg from '../assets/logo.svg'
import useStore from '../store/useStore'
import { t } from '../utils/i18n'

const TAGS = [
  { v: '%(title)s',          k: 'tagTitle' },
  { v: '%(uploader)s',       k: 'tagUploader' },
  { v: '%(upload_date)s',    k: 'tagDate' },
  { v: '%(id)s',             k: 'tagId' },
  { v: '%(ext)s',            k: 'tagExt' },
  { v: '%(resolution)s',     k: 'tagRes' },
  { v: '%(playlist_title)s', k: 'tagPlaylist' },
  { v: '%(playlist_index)s', k: 'tagIndex' }
]

const SPEED_PRESETS = [
  { label: 'No Limit', val: '' },
  { label: '1 MB/s',   val: '1M' },
  { label: '2 MB/s',   val: '2M' },
  { label: '5 MB/s',   val: '5M' },
  { label: '10 MB/s',  val: '10M' },
  { label: '20 MB/s',  val: '20M' }
]

function ToggleSwitch({ checked, onChange, title, desc }) {
  return (
    <div className="settings-toggle-row" onClick={() => onChange(!checked)}>
      <div className="toggle-text-wrap">
        <span className="toggle-title">{title}</span>
        {desc && <span className="toggle-desc">{desc}</span>}
      </div>
      <div className={`switch-toggle ${checked ? 'active' : ''}`}>
        <div className="switch-knob" />
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const lang = useStore((s) => s.language)
  const setLanguage = useStore((s) => s.setLanguage)
  const clearCompletedTasks = useStore((s) => s.clearCompletedTasks)

  const [activeTab, setActiveTab] = useState('general') // 'general' | 'downloads' | 'formats' | 'cookies' | 'engine' | 'developer' | 'about'
  const [cfg, setCfg] = useState({
    downloadPath: '',
    language: lang || 'en',
    concurrency: 3,
    limitRate: '',
    proxy: '',
    cookiesFromBrowser: '',
    cookiesFilePath: '',
    nameTemplate: '%(title)s.%(ext)s',
    autoUpdate: true,
    embedThumbnail: true,
    addMetadata: true,
    preferredVideoFormat: 'mp4',
    preferredAudioFormat: 'mp3',
    embedSubs: 'none',
    notifyOnComplete: true,
    soundOnComplete: false,
    autoOpenFolder: false,
    retries: 3,
    socketTimeout: 30,
    customUserAgent: '',
    extraArgs: '',
    customYtDlpPath: '',
    customFfmpegPath: ''
  })
  const [saved, setSaved] = useState(false)
  
  // Binary info state
  const [binInfo, setBinInfo] = useState(null)
  const [isUpdatingYtDlp, setIsUpdatingYtDlp] = useState(false)
  const [isDownloadingFfmpeg, setIsDownloadingFfmpeg] = useState(false)
  const [updateStatusMsg, setUpdateStatusMsg] = useState(null)
  const [devResetSuccess, setDevResetSuccess] = useState(false)

  const handleTestSetup = () => {
    useStore.getState().setIsSetupActive(true)
  }

  const handleResetFirstRun = async () => {
    try {
      await window.api.resetFirstRun?.()
      setDevResetSuccess(true)
      setTimeout(() => setDevResetSuccess(false), 3500)
    } catch (e) {
      console.error('Failed to reset firstRun:', e)
    }
  }

  const handleToggleDevTools = async () => {
    try {
      await window.api.toggleDevTools?.()
    } catch (e) {
      console.error('Failed to toggle DevTools:', e)
    }
  }

  // Load settings & binaries info
  useEffect(() => {
    window.api.getSettings?.().then((loaded) => {
      if (loaded) {
        setCfg(loaded)
        if (loaded.language && loaded.language !== lang) {
          setLanguage(loaded.language)
        }
      }
    })
    loadBinInfo()
  }, [])

  const loadBinInfo = async (forceRefresh = false) => {
    try {
      const info = await window.api.getBinaryInfo?.(forceRefresh)
      if (info) setBinInfo(info)
    } catch {
      // ignore
    }
  }

  const set = (k, v) => {
    setCfg((c) => ({ ...c, [k]: v }))
    setSaved(false)
  }

  const handleLanguageChange = (newLang) => {
    set('language', newLang)
    setLanguage(newLang)
    // Immediately persist language so navigating pages retains it
    if (cfg) {
      window.api.saveSettings({ ...cfg, language: newLang })
    }
  }

  const save = async () => {
    if (!cfg) return
    await window.api.saveSettings(cfg)
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  const pickDownloadFolder = async () => {
    const f = await window.api.selectFolder()
    if (f) set('downloadPath', f)
  }

  const openDownloadFolder = () => {
    if (cfg?.downloadPath) {
      window.api.openFolder?.(cfg.downloadPath)
    }
  }

  const pickCookiesFile = async () => {
    const f = await window.api.selectFile?.([
      { name: 'Text / Cookies File', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ])
    if (f) set('cookiesFilePath', f)
  }

  const pickCustomYtDlp = async () => {
    const f = await window.api.selectFile?.([
      { name: 'Executable', extensions: ['exe'] },
      { name: 'All Files', extensions: ['*'] }
    ])
    if (f) set('customYtDlpPath', f)
  }

  const pickCustomFfmpeg = async () => {
    const f = await window.api.selectFile?.([
      { name: 'Executable', extensions: ['exe'] },
      { name: 'All Files', extensions: ['*'] }
    ])
    if (f) set('customFfmpegPath', f)
  }

  const handleUpdateYtDlp = async () => {
    setIsUpdatingYtDlp(true)
    setUpdateStatusMsg(null)
    try {
      const res = await window.api.updateYtDlp?.()
      if (res && res.success) {
        setUpdateStatusMsg({ type: 'success', text: res.message || 'yt-dlp успешно обновлен' })
        loadBinInfo()
      } else {
        setUpdateStatusMsg({ type: 'error', text: res?.error || 'Ошибка при обновлении yt-dlp' })
      }
    } catch (e) {
      setUpdateStatusMsg({ type: 'error', text: e.message })
    } finally {
      setIsUpdatingYtDlp(false)
    }
  }

  const handleDownloadFfmpeg = async () => {
    setIsDownloadingFfmpeg(true)
    setUpdateStatusMsg(null)
    try {
      const res = await window.api.downloadFfmpeg?.()
      if (res && res.success) {
        setUpdateStatusMsg({ type: 'success', text: res.message || 'FFmpeg успешно установлен' })
        loadBinInfo(true)
      } else {
        setUpdateStatusMsg({ type: 'error', text: res?.error || 'Ошибка при загрузке FFmpeg' })
      }
    } catch (e) {
      setUpdateStatusMsg({ type: 'error', text: e.message })
    } finally {
      setIsDownloadingFfmpeg(false)
    }
  }

  const handleResetSettings = async () => {
    if (window.confirm(t('resetConfirm', lang))) {
      const reset = await window.api.resetSettings()
      if (reset) {
        setCfg(reset)
        if (reset.language) setLanguage(reset.language)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    }
  }

  const handleClearCompleted = () => {
    window.api.clearCompletedDownloads?.()
    clearCompletedTasks()
  }

  const insertTag = (tag) => {
    set('nameTemplate', (cfg.nameTemplate || '') + tag)
  }

  // Live evaluated filename preview
  const livePreview = useMemo(() => {
    const tpl = cfg?.nameTemplate || '%(title)s [%(resolution)s]'
    const ext = cfg?.preferredVideoFormat || 'mp4'
    let res = tpl
      .replace(/%\(title\)s/g, 'Sample Video Title')
      .replace(/%\(uploader\)s/g, 'TechChannel')
      .replace(/%\(upload_date\)s/g, '20260907')
      .replace(/%\(id\)s/g, 'dQw4w9WgXcQ')
      .replace(/%\(ext\)s/g, ext)
      .replace(/%\(resolution\)s/g, '1080p')
      .replace(/%\(playlist_title\)s/g, 'Favorite Hits')
      .replace(/%\(playlist_index\)s/g, '01')
    
    if (!res.toLowerCase().endsWith(`.${ext}`)) {
      res = `${res}.${ext}`
    }
    return res
  }, [cfg?.nameTemplate, cfg?.preferredVideoFormat])

  if (!cfg) {
    return (
      <div className="page-content center-spinner">
        <div className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    )
  }

  // Select dropdown option collections
  const CONCURRENCY_OPTIONS = [1, 2, 3, 4, 6, 8].map((num) => ({
    value: num,
    label: `${num} ${lang === 'en' ? (num === 1 ? 'task' : 'tasks') : (num === 1 ? 'задача' : num < 5 ? 'задачи' : 'задач')}`
  }))

  const BROWSER_OPTIONS = [
    { value: '',        label: t('browserNone', lang) },
    { value: 'chrome',  label: 'Google Chrome' },
    { value: 'edge',    label: 'Microsoft Edge' },
    { value: 'firefox', label: 'Mozilla Firefox' },
    { value: 'brave',   label: 'Brave Browser' },
    { value: 'opera',   label: 'Opera' },
    { value: 'vivaldi', label: 'Vivaldi' },
    { value: 'safari',  label: 'Safari' }
  ]

  const VIDEO_CONTAINER_OPTIONS = [
    { value: 'mp4',  label: lang === 'en' ? 'MP4 (Recommended / Default)' : 'MP4 (Рекомендуется / По умолчанию)' },
    { value: 'mkv',  label: 'MKV (Matroska)' },
    { value: 'webm', label: 'WebM' }
  ]

  const AUDIO_FORMAT_OPTIONS = [
    { value: 'mp3',  label: lang === 'en' ? 'MP3 (Most Compatible)' : 'MP3 (Наиболее совместимый)' },
    { value: 'm4a',  label: lang === 'en' ? 'M4A / AAC (High Quality)' : 'M4A / AAC (Высокое качество)' },
    { value: 'flac', label: 'FLAC (Lossless)' },
    { value: 'opus', label: lang === 'en' ? 'Opus (Modern Codec)' : 'Opus (Современный кодек)' },
    { value: 'wav',  label: 'WAV' }
  ]

  const SUBS_OPTIONS = [
    { value: 'none', label: t('subsNone', lang) },
    { value: 'ru',   label: t('subsRu', lang) },
    { value: 'en',   label: t('subsEn', lang) },
    { value: 'all',  label: t('subsAll', lang) }
  ]

  const NAV_TABS = [
    { id: 'general',   label: t('catGeneral', lang),   Icon: Sliders },
    { id: 'downloads', label: t('catDownloads', lang), Icon: Download },
    { id: 'formats',   label: t('catFormats', lang),   Icon: Film },
    { id: 'cookies',   label: t('catCookies', lang),   Icon: Key },
    { id: 'engine',    label: t('catEngine', lang),    Icon: Cpu },
    { id: 'developer', label: t('catDeveloper', lang), Icon: FileCode },
    { id: 'about',     label: t('catAbout', lang),     Icon: Info }
  ]

  return (
    <div className="page-content settings-v2-container">
      {/* ── Top Header Row ────────────────────────────────────────────── */}
      <div className="settings-v2-header">
        <div className="settings-header-title-wrap">
          <h1 className="settings-main-title">{t('titleSettings', lang)}</h1>
          <p className="settings-subtitle">
            {lang === 'en' ? 'Configure application behavior, engine parameters, and media formats' : 'Настройка поведения программы, параметров движка и форматов медиа'}
          </p>
        </div>

        <button
          id="save-settings-btn"
          className={`btn btn-primary ${saved ? 'btn-saved' : ''}`}
          onClick={save}
        >
          {saved ? (
            <>
              <CheckCircle2 size={16} />
              <span>{t('settingsSaved', lang)}</span>
            </>
          ) : (
            <>
              <Save size={16} />
              <span>{t('btnSaveSettings', lang)}</span>
            </>
          )}
        </button>
      </div>

      {/* ── Main Layout: Sidebar Tabs + Content Panel ─────────────────── */}
      <div className="settings-v2-layout">
        {/* Left Navigation Bar */}
        <div className="settings-tabs-sidebar">
          {NAV_TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`settings-nav-item ${activeTab === id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={17} className="settings-nav-icon" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Right Content Panel */}
        <div className="settings-tab-content-panel">
          {/* ══════════════════════════════════════════════════════════════
              TAB 1: GENERAL
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'general' && (
            <div className="settings-section-card animate-fade">
              <h2 className="section-card-title">
                <Sliders size={18} />
                <span>{t('catGeneral', lang)}</span>
              </h2>

              {/* Language Switcher */}
              <div className="settings-control-group">
                <div className="control-group-header">
                  <span className="control-title">{t('langSectionTitle', lang)}</span>
                  <span className="control-desc">{t('langSectionDesc', lang)}</span>
                </div>
                <div className="lang-segmented-group">
                  <button
                    type="button"
                    className={`lang-segment-btn ${lang === 'ru' ? 'is-active' : ''}`}
                    onClick={() => handleLanguageChange('ru')}
                  >
                    <span className="lang-code">RU</span>
                    <span className="lang-name">Русский</span>
                  </button>
                  <button
                    type="button"
                    className={`lang-segment-btn ${lang === 'en' ? 'is-active' : ''}`}
                    onClick={() => handleLanguageChange('en')}
                  >
                    <span className="lang-code">EN</span>
                    <span className="lang-name">English</span>
                  </button>
                </div>
              </div>

              {/* Download Directory */}
              <div className="settings-control-group">
                <div className="control-group-header">
                  <span className="control-title">{t('downloadFolderTitle', lang)}</span>
                  <span className="control-desc">{t('downloadFolderDesc', lang)}</span>
                </div>
                <div className="folder-picker-row">
                  <input
                    type="text"
                    className="input input-sm font-mono flex-1"
                    value={cfg.downloadPath || ''}
                    onChange={(e) => set('downloadPath', e.target.value)}
                  />
                  <button className="btn btn-secondary" onClick={pickDownloadFolder}>
                    <FolderOpen size={15} />
                    <span>{t('btnBrowse', lang)}</span>
                  </button>
                  <button className="btn btn-secondary" onClick={openDownloadFolder}>
                    <ExternalLink size={15} />
                    <span>{t('btnOpenFolder', lang)}</span>
                  </button>
                </div>
              </div>

              {/* Behavior & Notifications */}
              <div className="settings-control-group">
                <div className="control-group-header">
                  <span className="control-title">{t('behaviorTitle', lang)}</span>
                </div>
                <div className="toggle-switches-list">
                  <ToggleSwitch
                    title={t('optNotifyComplete', lang)}
                    desc={lang === 'en' ? 'Show desktop push notification when media file is ready' : 'Показывать системное оповещение на рабочем столе'}
                    checked={Boolean(cfg.notifyOnComplete)}
                    onChange={(val) => set('notifyOnComplete', val)}
                  />
                  <ToggleSwitch
                    title={t('optSoundComplete', lang)}
                    desc={lang === 'en' ? 'Play an audible chime upon successful completion' : 'Воспроизводить приятный звуковой сигнал'}
                    checked={Boolean(cfg.soundOnComplete)}
                    onChange={(val) => set('soundOnComplete', val)}
                  />
                  <ToggleSwitch
                    title={t('optAutoOpenFolder', lang)}
                    desc={lang === 'en' ? 'Reveal the output directory after task is finished' : 'Автоматически открывать проводник после завершения'}
                    checked={Boolean(cfg.autoOpenFolder)}
                    onChange={(val) => set('autoOpenFolder', val)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB 2: DOWNLOADS & NETWORK
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'downloads' && (
            <div className="settings-section-card animate-fade">
              <h2 className="section-card-title">
                <Download size={18} />
                <span>{t('catDownloads', lang)}</span>
              </h2>

              {/* Concurrency */}
              <div className="settings-control-group">
                <div className="control-group-header">
                  <span className="control-title">{t('concurrencyTitle', lang)}</span>
                  <span className="control-desc">{t('concurrencyDesc', lang)}</span>
                </div>
                <div style={{ maxWidth: 360 }}>
                  <CustomSelect
                    value={cfg.concurrency || 3}
                    onChange={(val) => set('concurrency', Number(val))}
                    options={CONCURRENCY_OPTIONS}
                    icon={Layers}
                  />
                </div>
              </div>

              {/* Speed Limit */}
              <div className="settings-control-group">
                <div className="control-group-header">
                  <span className="control-title">{t('speedLimitTitle', lang)}</span>
                  <span className="control-desc">{t('speedLimitDesc', lang)}</span>
                </div>
                <div className="speed-limit-block">
                  <input
                    type="text"
                    className="input input-sm font-mono"
                    placeholder={lang === 'en' ? 'Unlimited (e.g. 5M, 500K)' : 'Без ограничений (напр. 5M, 500K)'}
                    value={cfg.limitRate || ''}
                    onChange={(e) => set('limitRate', e.target.value)}
                  />
                  <div className="speed-preset-chips">
                    {SPEED_PRESETS.map((p) => {
                      const isActive = (cfg.limitRate || '') === p.val
                      return (
                        <button
                          key={p.label}
                          type="button"
                          className={`preset-chip ${isActive ? 'active' : ''}`}
                          onClick={() => set('limitRate', p.val)}
                        >
                          {p.val === '' ? t('speedNoLimit', lang) : p.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Proxy */}
              <div className="settings-control-group">
                <div className="control-group-header">
                  <span className="control-title">{t('proxyTitle', lang)}</span>
                  <span className="control-desc">{t('proxyDesc', lang)}</span>
                </div>
                <input
                  type="text"
                  className="input input-sm font-mono"
                  placeholder={t('proxyPlaceholder', lang)}
                  value={cfg.proxy || ''}
                  onChange={(e) => set('proxy', e.target.value)}
                />
              </div>

              {/* Network Retries & Timeout */}
              <div className="settings-two-col-grid">
                <div className="settings-control-group">
                  <span className="control-title">{t('retriesTitle', lang)}</span>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    className="input input-sm"
                    value={cfg.retries ?? 5}
                    onChange={(e) => set('retries', Number(e.target.value))}
                  />
                </div>
                <div className="settings-control-group">
                  <span className="control-title">{t('timeoutTitle', lang)}</span>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    className="input input-sm"
                    value={cfg.socketTimeout ?? 30}
                    onChange={(e) => set('socketTimeout', Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB 3: FORMATS & FILENAME
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'formats' && (
            <div className="settings-section-card animate-fade">
              <h2 className="section-card-title">
                <Film size={18} />
                <span>{t('catFormats', lang)}</span>
              </h2>

              {/* Filename Template */}
              <div className="settings-control-group">
                <div className="control-group-header">
                  <span className="control-title">{t('nameTemplateTitle', lang)}</span>
                  <span className="control-desc">{t('nameTemplateDesc', lang)}</span>
                </div>
                <input
                  type="text"
                  className="input input-sm font-mono"
                  value={cfg.nameTemplate || ''}
                  onChange={(e) => set('nameTemplate', e.target.value)}
                />

                {/* Tag chips */}
                <div className="tags-block">
                  <span className="tags-label">{t('insertTagTitle', lang)}</span>
                  <div className="tags-chips-list">
                    {TAGS.map(({ v, k }) => (
                      <button
                        key={v}
                        type="button"
                        className="template-tag-chip"
                        title={t(k, lang)}
                        onClick={() => insertTag(v)}
                      >
                        <span className="tag-code">{v}</span>
                        <span className="tag-desc">{t(k, lang)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Output Filename Preview */}
                <div className="filename-live-preview-box">
                  <div className="preview-header">
                    <Sparkles size={14} className="preview-icon" />
                    <span>{t('livePreviewTitle', lang)}</span>
                  </div>
                  <div className="preview-filename-text font-mono">
                    {livePreview}
                  </div>
                </div>
              </div>

              {/* Preferred Video & Audio Formats */}
              <div className="settings-two-col-grid">
                <div className="settings-control-group">
                  <span className="control-title">{t('defaultVideoContainer', lang)}</span>
                  <CustomSelect
                    value={cfg.preferredVideoFormat || 'mp4'}
                    onChange={(val) => set('preferredVideoFormat', val)}
                    options={VIDEO_CONTAINER_OPTIONS}
                    icon={Film}
                  />
                </div>
                <div className="settings-control-group">
                  <span className="control-title">{t('defaultAudioFormat', lang)}</span>
                  <CustomSelect
                    value={cfg.preferredAudioFormat || 'mp3'}
                    onChange={(val) => set('preferredAudioFormat', val)}
                    options={AUDIO_FORMAT_OPTIONS}
                    icon={Music}
                  />
                </div>
              </div>

              {/* Metadata & Subtitles */}
              <div className="settings-control-group">
                <div className="control-group-header">
                  <span className="control-title">{t('metadataTitle', lang)}</span>
                </div>
                <div className="toggle-switches-list">
                  <ToggleSwitch
                    title={t('optEmbedThumbnail', lang)}
                    desc={lang === 'en' ? 'Embed album art/video poster directly into MP4/MP3/MKV' : 'Вшивать обложку в аудио/видео файл для отображения в плеерах'}
                    checked={Boolean(cfg.embedThumbnail)}
                    onChange={(val) => set('embedThumbnail', val)}
                  />
                  <ToggleSwitch
                    title={t('optAddMetadata', lang)}
                    desc={lang === 'en' ? 'Write title, artist, upload date, chapters, and description tags' : 'Встраивать главы, описание, автора и метатеги'}
                    checked={Boolean(cfg.addMetadata)}
                    onChange={(val) => set('addMetadata', val)}
                  />
                </div>

                {/* Subtitles */}
                <div className="settings-subs-picker" style={{ marginTop: 12 }}>
                  <span className="control-title">{t('optEmbedSubs', lang)}</span>
                  <div style={{ maxWidth: 360, marginTop: 6 }}>
                    <CustomSelect
                      value={cfg.embedSubs || 'none'}
                      onChange={(val) => set('embedSubs', val)}
                      options={SUBS_OPTIONS}
                      icon={FileCode}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB 4: AUTH & COOKIES
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'cookies' && (
            <div className="settings-section-card animate-fade">
              <h2 className="section-card-title">
                <Key size={18} />
                <span>{t('catCookies', lang)}</span>
              </h2>

              {/* Browser Cookies */}
              <div className="settings-control-group">
                <div className="control-group-header">
                  <span className="control-title">{t('cookiesBrowserTitle', lang)}</span>
                  <span className="control-desc">{t('cookiesBrowserDesc', lang)}</span>
                </div>
                <div style={{ maxWidth: 360 }}>
                  <CustomSelect
                    value={cfg.cookiesFromBrowser || ''}
                    onChange={(val) => set('cookiesFromBrowser', val)}
                    options={BROWSER_OPTIONS}
                    icon={Globe}
                  />
                </div>
                {cfg.cookiesFromBrowser && (
                  <div className="settings-warning-box">
                    <AlertCircle size={15} />
                    <span>{t('browserWarning', lang)}</span>
                  </div>
                )}
              </div>

              {/* Custom cookies.txt */}
              <div className="settings-control-group">
                <div className="control-group-header">
                  <span className="control-title">{t('cookiesFileTitle', lang)}</span>
                  <span className="control-desc">{t('cookiesFileDesc', lang)}</span>
                </div>
                <div className="folder-picker-row">
                  <input
                    type="text"
                    className="input input-sm font-mono flex-1"
                    placeholder="C:\path\to\cookies.txt"
                    value={cfg.cookiesFilePath || ''}
                    onChange={(e) => set('cookiesFilePath', e.target.value)}
                  />
                  <button className="btn btn-secondary" onClick={pickCookiesFile}>
                    <FolderOpen size={15} />
                    <span>{t('btnBrowse', lang)}</span>
                  </button>
                </div>
              </div>

              {/* User-Agent */}
              <div className="settings-control-group">
                <div className="control-group-header">
                  <span className="control-title">{t('userAgentTitle', lang)}</span>
                </div>
                <input
                  type="text"
                  className="input input-sm font-mono"
                  placeholder={t('userAgentPlaceholder', lang)}
                  value={cfg.customUserAgent || ''}
                  onChange={(e) => set('customUserAgent', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB 5: ENGINE & BINARIES
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'engine' && (
            <div className="settings-section-card animate-fade">
              <h2 className="section-card-title">
                <Cpu size={18} />
                <span>{t('catEngine', lang)}</span>
              </h2>

              {/* Binary Status Grid */}
              <div className="binary-status-cards-grid">
                {/* Card 1: yt-dlp */}
                <div className="binary-status-card">
                  <div className="binary-card-head">
                    <div className="binary-card-icon">
                      <Cpu size={20} />
                    </div>
                    <div className="binary-card-info">
                      <h4 className="binary-card-title">{t('ytdlpEngineTitle', lang)}</h4>
                      <div className="binary-card-version">
                        {(binInfo?.ytdlp?.installed || binInfo?.ytdlp?.exists) ? (
                          <span className="badge-ver success">
                            ✓ {t('versionFound', lang, { version: binInfo.ytdlp.version || 'Ready' })}
                          </span>
                        ) : (
                          <span className="badge-ver alert">
                            {t('versionNotFound', lang)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="binary-card-body">
                    <p className="binary-card-path font-mono" title={binInfo?.ytdlp?.path || ''}>
                      {binInfo?.ytdlp?.path || 'bundled / default'}
                    </p>
                  </div>

                  <div className="binary-card-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleUpdateYtDlp}
                      disabled={isUpdatingYtDlp}
                    >
                      <RefreshCw size={13} className={isUpdatingYtDlp ? 'spin-anim' : ''} />
                      <span>{isUpdatingYtDlp ? t('updatingYtDlp', lang) : t('btnUpdateYtDlp', lang)}</span>
                    </button>
                  </div>
                </div>

                {/* Card 2: FFmpeg */}
                <div className="binary-status-card">
                  <div className="binary-card-head">
                    <div className="binary-card-icon">
                      <Film size={20} />
                    </div>
                    <div className="binary-card-info">
                      <h4 className="binary-card-title">{t('ffmpegEngineTitle', lang)}</h4>
                      <div className="binary-card-version">
                        {(binInfo?.ffmpeg?.installed || binInfo?.ffmpeg?.exists) ? (
                          <span className="badge-ver success">
                            ✓ {t('versionFound', lang, { version: binInfo.ffmpeg.version || 'Ready' })}
                          </span>
                        ) : (
                          <span className="badge-ver alert">
                            {t('versionNotFound', lang)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="binary-card-body">
                    <p className="binary-card-path font-mono" title={binInfo?.ffmpeg?.path || ''}>
                      {binInfo?.ffmpeg?.path || 'bundled / default'}
                    </p>
                  </div>

                  <div className="binary-card-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleDownloadFfmpeg}
                      disabled={isDownloadingFfmpeg}
                    >
                      <Download size={13} className={isDownloadingFfmpeg ? 'spin-anim' : ''} />
                      <span>
                        {isDownloadingFfmpeg
                          ? t('downloadingFfmpeg', lang)
                          : (binInfo?.ffmpeg?.installed || binInfo?.ffmpeg?.exists)
                            ? t('btnUpdateFfmpeg', lang)
                            : t('btnDownloadFfmpeg', lang)}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Update Feedback Status Toast */}
              {updateStatusMsg && (
                <div className={`settings-feedback-banner ${updateStatusMsg.type}`}>
                  {updateStatusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{updateStatusMsg.text}</span>
                </div>
              )}

              {/* Custom Binary Paths */}
              <div className="settings-control-group" style={{ marginTop: 8 }}>
                <div className="control-group-header">
                  <span className="control-title">{t('customYtDlpTitle', lang)}</span>
                </div>
                <div className="folder-picker-row">
                  <input
                    type="text"
                    className="input input-sm font-mono flex-1"
                    placeholder="C:\tools\yt-dlp.exe"
                    value={cfg.customYtDlpPath || ''}
                    onChange={(e) => set('customYtDlpPath', e.target.value)}
                  />
                  <button className="btn btn-secondary" onClick={pickCustomYtDlp}>
                    <FolderOpen size={15} />
                    <span>{t('btnBrowse', lang)}</span>
                  </button>
                </div>
              </div>

              <div className="settings-control-group">
                <div className="control-group-header">
                  <span className="control-title">{t('customFfmpegTitle', lang)}</span>
                </div>
                <div className="folder-picker-row">
                  <input
                    type="text"
                    className="input input-sm font-mono flex-1"
                    placeholder="C:\tools\ffmpeg.exe"
                    value={cfg.customFfmpegPath || ''}
                    onChange={(e) => set('customFfmpegPath', e.target.value)}
                  />
                  <button className="btn btn-secondary" onClick={pickCustomFfmpeg}>
                    <FolderOpen size={15} />
                    <span>{t('btnBrowse', lang)}</span>
                  </button>
                </div>
              </div>

              {/* Extra CLI Arguments */}
              <div className="settings-control-group">
                <div className="control-group-header">
                  <span className="control-title">{t('extraArgsTitle', lang)}</span>
                </div>
                <input
                  type="text"
                  className="input input-sm font-mono"
                  placeholder={t('extraArgsPlaceholder', lang)}
                  value={cfg.extraArgs || ''}
                  onChange={(e) => set('extraArgs', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB 6: DEVELOPER & TESTING
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'developer' && (
            <div className="settings-section-card animate-fade">
              {/* Onboarding Wizard Testing */}
              <div className="settings-control-group">
                <div className="control-group-header">
                  <span className="control-title">{t('devTestSetupTitle', lang)}</span>
                  <span className="control-desc">{t('devTestSetupDesc', lang)}</span>
                </div>
                <div className="maintenance-buttons-row" style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleTestSetup}
                  >
                    <Sparkles size={15} />
                    <span>{t('btnTestSetup', lang)}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleResetFirstRun}
                  >
                    <RotateCcw size={15} />
                    <span>{t('btnResetFirstRun', lang)}</span>
                  </button>
                </div>
                {devResetSuccess && (
                  <div className="settings-feedback-banner success" style={{ marginTop: 10 }}>
                    <CheckCircle2 size={16} />
                    <span>{t('firstRunResetSuccess', lang)}</span>
                  </div>
                )}
              </div>

              {/* DevTools Console */}
              <div className="settings-control-group" style={{ marginTop: 20 }}>
                <div className="control-group-header">
                  <span className="control-title">{t('devToolsTitle', lang)}</span>
                  <span className="control-desc">{t('devToolsDesc', lang)}</span>
                </div>
                <div className="maintenance-buttons-row" style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleToggleDevTools}
                  >
                    <FileCode size={15} />
                    <span>{t('btnToggleDevTools', lang)}</span>
                  </button>
                </div>

                <div className="dev-code-hint-box" style={{ marginTop: 14 }}>
                  <div className="dev-hint-title">{lang === 'en' ? 'Code Configuration (src/main/index.js):' : 'Настройка в коде (src/main/index.js):'}</div>
                  <pre className="dev-hint-code">
                    {`const OPEN_DEVTOOLS_ON_STARTUP = true`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB 7: ABOUT
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'about' && (
            <div className="settings-section-card animate-fade">
              {/* App Monolithic Hero Banner */}
              <div className="about-hero-box">
                <img src={logoSvg} alt="App Logo" className="about-hero-logo" />
                <div className="about-hero-details">
                  <h3 className="about-hero-title">{t('aboutClientTitle', lang)}</h3>
                  <div className="about-hero-pills">
                    <span className="about-pill">{t('aboutVersion', lang)}</span>
                  </div>
                </div>
              </div>

              <p className="about-desc-text">
                {t('aboutDesc', lang)}
              </p>

              {/* Maintenance & Dangerous Zone */}
              <div className="about-maintenance-block">
                <h4 className="maintenance-heading">
                  {lang === 'en' ? 'Maintenance & Diagnostics' : 'Обслуживание и сброс'}
                </h4>
                <div className="maintenance-buttons-row">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleClearCompleted}
                  >
                    <Trash2 size={14} />
                    <span>{t('btnClearCompletedTasks', lang)}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm danger-btn"
                    onClick={handleResetSettings}
                  >
                    <RotateCcw size={14} />
                    <span>{t('btnResetDefaults', lang)}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


