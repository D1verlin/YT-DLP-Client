import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, createWriteStream, chmodSync } from 'fs'
import { get } from 'https'
import { platform, arch } from 'os'
import { exec, execSync } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

class BinaryManager {
  constructor(store) {
    this.store = store
    this.binDir = join(app.getPath('userData'), 'bin')
    this.os = platform()
    // Default locations inside userData/bin
    this._ytDlpDefault = join(this.binDir, this.os === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')
    this._ffmpegDefault = join(this.binDir, this.os === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
    this._cachedBinaryInfo = null
    this._pathCache = new Map()

    if (!existsSync(this.binDir)) {
      mkdirSync(this.binDir, { recursive: true })
    }
  }

  invalidateCache() {
    this._cachedBinaryInfo = null
    this._pathCache.clear()
  }

  // ─── PATH search ────────────────────────────────────────────────────────────
  /**
   * Search for a binary by name in the system PATH.
   * Returns the absolute path if found, otherwise null. Cached in memory.
   */
  _findInPath(name) {
    if (this._pathCache.has(name)) {
      return this._pathCache.get(name)
    }

    const cmd = this.os === 'win32' ? `where "${name}"` : `which "${name}"`
    try {
      const out = execSync(cmd, { encoding: 'utf-8', timeout: 3000, windowsHide: true })
      const candidates = out.trim().split(/\r?\n/).map((p) => p.trim()).filter(Boolean)
      const found = candidates.find((p) => existsSync(p)) || null
      this._pathCache.set(name, found)
      return found
    } catch {
      this._pathCache.set(name, null)
      return null
    }
  }

  // ─── Resolution helpers ─────────────────────────────────────────────────────
  /**
   * Resolve yt-dlp path using priority:
   * 1. Custom path saved by user
   * 2. System PATH
   * 3. userData/bin (downloaded by us)
   */
  getYtDlpPath() {
    const custom = this.store?.getSetting('customYtDlpPath')
    if (custom && existsSync(custom)) return custom

    const inPath = this._findInPath(this.os === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')
    if (inPath) return inPath

    return this._ytDlpDefault
  }

  getFfmpegPath() {
    const custom = this.store?.getSetting('customFfmpegPath')
    if (custom && existsSync(custom)) return custom

    const inPath = this._findInPath(this.os === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
    if (inPath) return inPath

    return this._ffmpegDefault
  }

  getBinDir() { return this.binDir }

  // ─── Readiness check ────────────────────────────────────────────────────────
  /**
   * Returns true if yt-dlp is available from ANY source.
   * ffmpeg is optional (needed only for video+audio muxing).
   */
  areBinariesReady() {
    // 1. Custom path
    const custom = this.store?.getSetting('customYtDlpPath')
    if (custom && existsSync(custom)) return true

    // 2. System PATH
    const inPath = this._findInPath(this.os === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')
    if (inPath) return true

    // 3. userData/bin
    return existsSync(this._ytDlpDefault)
  }

  // ─── Setup flow ─────────────────────────────────────────────────────────────
  async downloadBinaries(onProgress) {
    try {
      // ── yt-dlp ──
      onProgress({ stage: 'yt-dlp', percent: 0, message: 'Поиск yt-dlp в системе...' })

      const ytdlpInPath = this._findInPath(this.os === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')
      if (ytdlpInPath) {
        onProgress({
          stage: 'yt-dlp', percent: 100,
          message: `✓ yt-dlp найден в системе: ${ytdlpInPath}`
        })
      } else {
        onProgress({ stage: 'yt-dlp', percent: 5, message: 'yt-dlp не найден, загружаем...' })
        await this._downloadYtDlp(onProgress)
      }

      // ── ffmpeg ──
      onProgress({ stage: 'ffmpeg', percent: 0, message: 'Поиск ffmpeg в системе...' })

      const ffmpegInPath = this._findInPath(this.os === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
      if (ffmpegInPath) {
        onProgress({
          stage: 'ffmpeg', percent: 100,
          message: `✓ ffmpeg найден в системе: ${ffmpegInPath}`
        })
      } else {
        onProgress({
          stage: 'ffmpeg', percent: 100,
          message: 'ffmpeg не найден в PATH. Мёрдж видео+аудио может не работать.'
        })
      }

      onProgress({ stage: 'done', percent: 100, message: 'Все компоненты готовы!' })
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // ─── Private: download yt-dlp from GitHub releases ─────────────────────────
  async _downloadYtDlp(onProgress) {
    const os = this.os
    const architecture = arch()

    let assetName
    if (os === 'win32') {
      assetName = 'yt-dlp.exe'
    } else if (os === 'darwin') {
      assetName = architecture === 'arm64' ? 'yt-dlp_macos' : 'yt-dlp_macos_legacy'
    } else {
      assetName = architecture === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux'
    }

    onProgress({ stage: 'yt-dlp', percent: 8, message: 'Подключение к GitHub API...' })

    let releaseInfo
    try {
      releaseInfo = await this._fetchJson(
        'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest'
      )
    } catch (e) {
      throw new Error(
        `Не удалось подключиться к GitHub API: ${e.message}. ` +
        `Проверьте соединение или используйте ручную установку.`
      )
    }

    if (!releaseInfo || !Array.isArray(releaseInfo.assets)) {
      const hint = releaseInfo?.message ? ` (${releaseInfo.message})` : ''
      throw new Error(
        `GitHub API вернул неожиданный ответ${hint}. ` +
        `Лимит запросов исчерпан или доступ заблокирован. Используйте ручную установку.`
      )
    }

    const asset = releaseInfo.assets.find((a) => a.name === assetName)
    if (!asset) {
      throw new Error(
        `Бинарник "${assetName}" не найден в релизе. Используйте ручную установку.`
      )
    }

    await this._downloadFile(
      asset.browser_download_url,
      this._ytDlpDefault,
      (percent) => onProgress({ stage: 'yt-dlp', percent, message: `Загрузка yt-dlp... ${percent}%` })
    )

    if (os !== 'win32') {
      chmodSync(this._ytDlpDefault, '755')
    }
  }

  // ─── Private: HTTP helpers ──────────────────────────────────────────────────
  _fetchJson(url) {
    return new Promise((resolve, reject) => {
      const opts = { headers: { 'User-Agent': 'YT-DLP-Client/1.0' } }
      const req = get(url, opts, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return this._fetchJson(res.headers.location).then(resolve).catch(reject)
        }
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try { resolve(JSON.parse(data)) } catch { reject(new Error('Не удалось распарсить JSON')) }
        })
      })
      req.on('error', reject)
    })
  }

  _downloadFile(url, destPath, onProgress) {
    return new Promise((resolve, reject) => {
      const file = createWriteStream(destPath)

      const handleResponse = (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const r = get(res.headers.location, { headers: { 'User-Agent': 'YT-DLP-Client/1.0' } }, handleResponse)
          r.on('error', reject)
          return
        }

        const total = parseInt(res.headers['content-length'] || '0', 10)
        let downloaded = 0

        res.on('data', (chunk) => {
          downloaded += chunk.length
          if (total > 0) onProgress(Math.round((downloaded / total) * 100))
        })

        res.pipe(file)
        file.on('finish', () => { file.close(); resolve() })
        file.on('error', reject)
      }

      const req = get(url, { headers: { 'User-Agent': 'YT-DLP-Client/1.0' } }, handleResponse)
      req.on('error', reject)
    })
  }

  async getBinaryInfo(forceRefresh = false) {
    if (!forceRefresh && this._cachedBinaryInfo) {
      return this._cachedBinaryInfo
    }

    const ytdlpPath = this.getYtDlpPath()
    const ffmpegPath = this.getFfmpegPath()

    const ytdlpExists = Boolean(ytdlpPath && existsSync(ytdlpPath))
    const ffmpegExists = Boolean(ffmpegPath && existsSync(ffmpegPath))

    let ytdlpVersion = null
    let ffmpegVersion = null

    // Run version probes concurrently with execAsync to never block the main thread
    const probes = []

    if (ytdlpExists) {
      probes.push(
        execAsync(`"${ytdlpPath}" --version`, { timeout: 4000, windowsHide: true })
          .then(({ stdout }) => {
            ytdlpVersion = stdout.trim()
          })
          .catch(() => {})
      )
    }

    if (ffmpegExists) {
      probes.push(
        execAsync(`"${ffmpegPath}" -version`, { timeout: 4000, windowsHide: true })
          .then(({ stdout }) => {
            const match = stdout.match(/version\s+([^\s]+)/i)
            ffmpegVersion = match ? match[1] : 'Active'
          })
          .catch(() => {})
      )
    }

    await Promise.all(probes)

    this._cachedBinaryInfo = {
      ytdlp: { path: ytdlpPath, exists: ytdlpExists, installed: ytdlpExists, version: ytdlpVersion },
      ffmpeg: { path: ffmpegPath, exists: ffmpegExists, installed: ffmpegExists, version: ffmpegVersion }
    }

    return this._cachedBinaryInfo
  }

  async updateYtDlp() {
    const ytdlpPath = this.getYtDlpPath()
    if (ytdlpPath && existsSync(ytdlpPath)) {
      try {
        const { stdout } = await execAsync(`"${ytdlpPath}" --update`, { timeout: 45000, windowsHide: true })
        this.invalidateCache()
        return { success: true, message: stdout.trim() }
      } catch (err) {
        return { success: false, error: err.message }
      }
    }
    return { success: false, error: 'yt-dlp не найден на диске' }
  }
}

export { BinaryManager }
