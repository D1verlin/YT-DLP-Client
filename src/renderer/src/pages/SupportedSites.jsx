import { useState, useEffect, useMemo } from 'react'
import { Search, Globe, AlertTriangle, Key, Info, ExternalLink, X } from 'lucide-react'
import useStore from '../store/useStore'
import { t } from '../utils/i18n'

export default function SupportedSitesPage() {
  const lang = useStore((s) => s.language)
  const [sites, setSites] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [filterBroken, setFilterBroken] = useState(false)
  const [filterNetrc, setFilterNetrc] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.api.getSupportedSites?.()
      .then((res) => {
        if (res?.success) {
          setSites(res.sites || [])
          setTotal(res.total || 0)
        } else {
          setError(res?.error || 'Unknown error')
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let list = sites
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((s) => s.name.toLowerCase().includes(q))
    }
    if (filterBroken) list = list.filter((s) => s.isBroken)
    if (filterNetrc) list = list.filter((s) => s.netrc)
    return list
  }, [sites, query, filterBroken, filterNetrc])

  const brokenCount = useMemo(() => sites.filter((s) => s.isBroken).length, [sites])
  const netrcCount  = useMemo(() => sites.filter((s) => s.netrc).length, [sites])

  return (
    <div className="page-content sites-page">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="sites-header">
        <div className="sites-header-left">
          <h1 className="settings-main-title">{t('titleSites', lang)}</h1>
          <p className="settings-subtitle">{t('sitesSubtitle', lang)}</p>
        </div>
        {!loading && !error && (
          <span className="sites-total-badge">
            {t('sitesCount', lang, { count: total.toLocaleString() })}
          </span>
        )}
      </div>

      {/* ── Info card ────────────────────────────────────────────────── */}
      <div className="sites-info-card">
        <div className="sites-info-icon">
          <Info size={16} />
        </div>
        <div className="sites-info-text">
          <span className="sites-info-title">{t('sitesInfoTitle', lang)}</span>
          <span className="sites-info-desc">{t('sitesInfoDesc', lang)}</span>
        </div>
        <a
          href="#"
          className="sites-info-link"
          onClick={(e) => { e.preventDefault(); window.api.openExternal('https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md') }}
        >
          <ExternalLink size={13} />
          GitHub
        </a>
      </div>

      {/* ── Search + Filter row ──────────────────────────────────────── */}
      <div className="sites-toolbar">
        <div className="sites-search-wrap">
          <Search size={15} className="sites-search-icon" />
          <input
            type="text"
            className="sites-search-input"
            placeholder={t('sitesSearchPlaceholder', lang)}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="sites-search-clear" onClick={() => setQuery('')}>
              <X size={13} />
            </button>
          )}
        </div>

        <div className="sites-filters">
          <button
            className={`sites-filter-btn ${filterBroken ? 'is-active-broken' : ''}`}
            onClick={() => setFilterBroken((v) => !v)}
            title={t('sitesBroken', lang)}
          >
            <AlertTriangle size={13} />
            <span>{t('sitesBroken', lang)}</span>
            {!filterBroken && <span className="sites-filter-count">{brokenCount}</span>}
          </button>
          <button
            className={`sites-filter-btn ${filterNetrc ? 'is-active-netrc' : ''}`}
            onClick={() => setFilterNetrc((v) => !v)}
            title={t('sitesNetrc', lang)}
          >
            <Key size={13} />
            <span>{t('sitesNetrc', lang)}</span>
            {!filterNetrc && <span className="sites-filter-count">{netrcCount}</span>}
          </button>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      {loading && (
        <div className="sites-state-box">
          <div className="spinner" style={{ width: 26, height: 26 }} />
          <span>{t('sitesLoading', lang)}</span>
        </div>
      )}

      {!loading && error && (
        <div className="sites-state-box sites-error">
          <AlertTriangle size={28} />
          <span>{t('sitesError', lang)}</span>
          <span className="sites-error-detail">{error}</span>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="sites-state-box">
          <Globe size={36} style={{ opacity: 0.3 }} />
          <span style={{ fontWeight: 500 }}>{t('sitesNoResults', lang)}</span>
          {query && (
            <span className="settings-subtitle">
              {t('sitesNoResultsDesc', lang, { query })}
            </span>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="sites-grid">
          {filtered.map((site) => (
            <div
              key={site.name}
              className={`site-card ${site.isBroken ? 'site-card-broken' : ''}`}
            >
              <span className="site-card-name">{site.name}</span>
              <div className="site-card-badges">
                {site.isBroken && (
                  <span className="site-badge site-badge-broken">
                    <AlertTriangle size={10} />
                    {t('sitesBroken', lang)}
                  </span>
                )}
                {site.netrc && (
                  <span className="site-badge site-badge-netrc" title={`netrc: ${site.netrc}`}>
                    <Key size={10} />
                    {t('sitesNetrc', lang)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
