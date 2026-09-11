import { autoUpdater } from 'electron-updater'
import { app, shell } from 'electron'
import https from 'https'

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

    return new Promise((resolve) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${this.githubOwner}/${this.githubRepo}/releases/latest`,
        headers: {
          'User-Agent': 'YT-DLP-Client-Updater',
          Accept: 'application/vnd.github.v3+json'
        },
        timeout: 10000
      }

      const req = https.get(options, (res) => {
        let rawData = ''
        res.on('data', (chunk) => {
          rawData += chunk
        })
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const release = JSON.parse(rawData)
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
                resolve({ available: true, info })
              } else {
                this._notify({
                  status: 'not-available',
                  latestVersion: latestVer,
                  error: null
                })
                resolve({ available: false, version: latestVer })
              }
            } catch (err) {
              this._notify({ status: 'error', error: 'Failed to parse release data' })
              resolve({ available: false, error: err.message })
            }
          } else {
            this._notify({ status: 'error', error: `GitHub API error (HTTP ${res.statusCode})` })
            resolve({ available: false, error: `HTTP ${res.statusCode}` })
          }
        })
      })

      req.on('error', (err) => {
        this._notify({ status: 'error', error: err.message || 'Network error' })
        resolve({ available: false, error: err.message })
      })

      req.on('timeout', () => {
        req.destroy()
        this._notify({ status: 'error', error: 'Connection timeout' })
        resolve({ available: false, error: 'timeout' })
      })
    })
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
