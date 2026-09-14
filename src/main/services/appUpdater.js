import { autoUpdater } from 'electron-updater'
import { app, shell, net } from 'electron'

function compareSemver(v1, v2) {
  const parse = (v) =>
    (v || '')
      .replace(/^v/i, '')
      .split('.')
      .map((p) => parseInt(p, 10) || 0)
  const [maj1 = 0, min1 = 0, pat1 = 0] = parse(v1)
  const [maj2 = 0, min2 = 0, pat2 = 0] = parse(v2)
  if (maj1 !== maj2) return maj1 - maj2
  if (min1 !== min2) return min1 - min2
  return pat1 - pat2
}

export class AppUpdateManager {
  constructor(mainWindow, store) {
    this.mainWindow = mainWindow
    this.store = store
    this.githubOwner = 'D1verlin'
    this.githubRepo = 'YT-DLP-Client'

    this.state = {
      status: 'idle', // 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
      currentVersion: app.getVersion(),
      latestVersion: null,
      updateInfo: null,
      progress: null,
      error: null
    }

    this._initAutoUpdater()
  }

  setWindow(window) {
    this.mainWindow = window
  }

  _notify(patch = {}) {
    this.state = { ...this.state, ...patch }
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('updater:status', this.state)
    }
  }

  _initAutoUpdater() {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = false

    autoUpdater.setFeedURL({
      provider: 'github',
      owner: this.githubOwner,
      repo: this.githubRepo
    })

    autoUpdater.on('checking-for-update', () => {
      this._notify({ status: 'checking', error: null })
    })

    autoUpdater.on('update-available', (info) => {
      this._notify({
        status: 'available',
        latestVersion: info.version,
        updateInfo: {
          version: info.version,
          releaseDate: info.releaseDate,
          releaseNotes: info.releaseNotes,
          releaseName: info.releaseName
        },
        error: null
      })
    })

    autoUpdater.on('update-not-available', (info) => {
      this._notify({
        status: 'not-available',
        latestVersion: info?.version || this.state.currentVersion,
        error: null
      })
    })

    autoUpdater.on('error', (err) => {
      // In dev mode, autoUpdater fails because app is not packaged; we fallback to GitHub API
      if (!app.isPackaged) {
        this._checkViaGitHubApi(false)
        return
      }
      this._notify({
        status: 'error',
        error: err?.message || 'Update check failed'
      })
    })

    autoUpdater.on('download-progress', (progressObj) => {
      this._notify({
        status: 'downloading',
        progress: {
          percent: Math.round(progressObj.percent || 0),
          bytesPerSecond: progressObj.bytesPerSecond || 0,
          transferred: progressObj.transferred || 0,
          total: progressObj.total || 0
        }
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      this._notify({
        status: 'downloaded',
        latestVersion: info.version,
        updateInfo: {
          ...this.state.updateInfo,
          version: info.version
        },
        progress: { percent: 100 }
      })
    })
  }

  async _checkViaGitHubApi(isSilent = false) {
    if (!isSilent) {
      this._notify({ status: 'checking', error: null })
    }

    try {
      const fetchFn = (typeof net !== 'undefined' && typeof net.fetch === 'function') ? net.fetch : globalThis.fetch
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 12000)

      const res = await fetchFn(
        `https://api.github.com/repos/${this.githubOwner}/${this.githubRepo}/releases/latest`,
        {
          signal: controller.signal,
          headers: {
            'User-Agent': 'YT-DLP-Client-Updater',
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      )
      clearTimeout(timeoutId)

      if (res.status === 200) {
        const release = await res.json()
        const latestTag = release.tag_name || ''
        const latestVer = latestTag.replace(/^v/i, '')
        const currentVer = app.getVersion()

        const isNewer = compareSemver(latestVer, currentVer) > 0

        if (isNewer) {
          const info = {
            version: latestVer,
            releaseName: release.name || latestTag,
            releaseDate: release.published_at,
            releaseNotes: release.body,
            htmlUrl: release.html_url,
            assets: (release.assets || []).map((a) => ({
              name: a.name,
              size: a.size,
              downloadUrl: a.browser_download_url
            }))
          }
          this._notify({
            status: 'available',
            latestVersion: latestVer,
            updateInfo: info,
            error: null
          })
          return { available: true, info }
        } else {
          this._notify({
            status: 'not-available',
            latestVersion: latestVer,
            error: null
          })
          return { available: false, version: latestVer }
        }
      } else if (res.status === 404) {
        this._notify({
          status: 'not-available',
          latestVersion: this.state.currentVersion,
          error: null
        })
        return { available: false, version: this.state.currentVersion }
      } else {
        const errText = `GitHub API HTTP ${res.status}`
        this._notify({ status: 'error', error: errText })
        return { available: false, error: errText }
      }
    } catch (err) {
      const isTimeout = err?.name === 'AbortError'
      const errMsg = isTimeout ? 'Connection timeout' : (err?.message || 'Network error')
      this._notify({ status: 'error', error: errMsg })
      return { available: false, error: errMsg }
    }
  }

  async checkForUpdates(isSilent = false) {
    if (this.state.status === 'checking' || this.state.status === 'downloading') {
      return this.state
    }

    if (!app.isPackaged) {
      return this._checkViaGitHubApi(isSilent)
    }

    try {
      if (!isSilent) {
        this._notify({ status: 'checking', error: null })
      }
      await autoUpdater.checkForUpdates()
      return this.state
    } catch (err) {
      console.warn('autoUpdater.checkForUpdates failed, falling back to GitHub API:', err.message)
      return this._checkViaGitHubApi(isSilent)
    }
  }

  async downloadUpdate() {
    if (this.state.status !== 'available' && this.state.status !== 'error') {
      return { success: false, error: 'No update available to download' }
    }

    if (app.isPackaged) {
      try {
        this._notify({ status: 'downloading', progress: { percent: 0 } })
        await autoUpdater.downloadUpdate()
        return { success: true }
      } catch (err) {
        this._notify({ status: 'error', error: err.message })
        return { success: false, error: err.message }
      }
    } else {
      // In dev mode or unpackaged, open the release page in browser
      if (this.state.updateInfo?.htmlUrl) {
        shell.openExternal(this.state.updateInfo.htmlUrl)
        return { success: true, openedBrowser: true }
      }
      return { success: false, error: 'Cannot download update in development mode' }
    }
  }

  quitAndInstall() {
    if (app.isPackaged) {
      autoUpdater.quitAndInstall(false, true)
    } else if (this.state.updateInfo?.htmlUrl) {
      shell.openExternal(this.state.updateInfo.htmlUrl)
    }
  }

  getState() {
    return this.state
  }
}
