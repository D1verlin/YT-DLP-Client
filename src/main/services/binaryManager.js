import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, createWriteStream, chmodSync, unlinkSync, renameSync, statSync } from 'fs'
import { get as httpsGet } from 'https'
import { get as httpGet } from 'http'
import { URL } from 'url'
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

  getBinDir() {
    return this.binDir
  }

  // ─── Custom path setters ───────────────────────────────────────────────────
  setCustomYtDlp(filePath) {
    if (filePath && existsSync(filePath)) {
      this.store?.saveSettings({ customYtDlpPath: filePath })
      this.invalidateCache()
      return true
    }
    return false
  }

  setCustomFfmpeg(filePath) {
    if (filePath && existsSync(filePath)) {
      this.store?.saveSettings({ customFfmpegPath: filePath })
      this.invalidateCache()
      return true
    }
    return false
  }

  // ─── Readiness check ────────────────────────────────────────────────────────
  areBinariesReady() {
    const custom = this.store?.getSetting('customYtDlpPath')
    if (custom && existsSync(custom)) return true

    const inPath = this._findInPath(this.os === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')
    if (inPath) return true

    return existsSync(this._ytDlpDefault)
  }

  // ─── Setup flow ─────────────────────────────────────────────────────────────
  async downloadBinaries(onProgress) {
    try {
      // ── yt-dlp ──
      onProgress({ stage: 'yt-dlp', percent: 0, message: 'Поиск yt-dlp в системе...' })

      const ytdlpPath = this.getYtDlpPath()
      const ytdlpFound = ytdlpPath && existsSync(ytdlpPath)

      if (ytdlpFound) {
        onProgress({
          stage: 'yt-dlp',
          percent: 100,
          message: `✓ yt-dlp готов: ${ytdlpPath}`
        })
      } else {
        onProgress({ stage: 'yt-dlp', percent: 5, message: 'Загрузка yt-dlp...' })
        await this._downloadYtDlp(onProgress)
      }

      // ── ffmpeg ──
      onProgress({ stage: 'ffmpeg', percent: 0, message: 'Поиск ffmpeg в системе...' })

      const ffmpegPath = this.getFfmpegPath()
      const ffmpegFound = ffmpegPath && existsSync(ffmpegPath)

      if (ffmpegFound) {
        onProgress({
          stage: 'ffmpeg',
          percent: 100,
          message: `✓ ffmpeg найден: ${ffmpegPath}`
        })
      } else {
        onProgress({
          stage: 'ffmpeg',
          percent: 100,
          message: 'ffmpeg не найден (опционально для объединения потоков)'
        })
      }

      this.invalidateCache()
      onProgress({ stage: 'done', percent: 100, message: 'Все компоненты готовы к работе!' })
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // ─── Asset & Mirror Resolution ──────────────────────────────────────────────
  _getYtDlpAssetName() {
    const os = this.os
    const architecture = arch()

    if (os === 'win32') {
      return 'yt-dlp.exe'
    } else if (os === 'darwin') {
      return architecture === 'arm64' ? 'yt-dlp_macos' : 'yt-dlp_macos_legacy'
    } else {
      return architecture === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux'
    }
  }

  _getYtDlpDownloadCandidates(assetName) {
    const rawGhUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${assetName}`
    return [
      { name: 'GitHub Release CDN', url: rawGhUrl },
      { name: 'GHFast Mirror', url: `https://ghfast.top/${rawGhUrl}` },
      { name: 'GHProxy Mirror', url: `https://mirror.ghproxy.com/${rawGhUrl}` },
      { name: 'GH-Proxy Direct', url: `https://gh-proxy.com/${rawGhUrl}` }
    ]
  }

  // ─── Private: download yt-dlp with multi-mirror failover ────────────────────
  async _downloadYtDlp(onProgress) {
    const assetName = this._getYtDlpAssetName()
    const candidates = this._getYtDlpDownloadCandidates(assetName)

    let lastError = null

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]
      const mirrorIndex = i + 1
      const totalMirrors = candidates.length

      onProgress({
        stage: 'yt-dlp',
        percent: 8,
        message: `Подключение к источнику ${mirrorIndex}/${totalMirrors} (${candidate.name})...`
      })

      try {
        await this._downloadFileWithRedirects(
          candidate.url,
          this._ytDlpDefault,
          ({ percent, downloadedMB, totalMB, speedMBs }) => {
            const sizeInfo = totalMB ? ` (${downloadedMB} / ${totalMB} МБ • ${speedMBs} МБ/с)` : ` (${downloadedMB} МБ)`
            onProgress({
              stage: 'yt-dlp',
              percent,
              message: `Загрузка yt-dlp... ${percent}%${sizeInfo}`
            })
          }
        )

        // Success!
        onProgress({
          stage: 'yt-dlp',
          percent: 100,
          message: '✓ yt-dlp успешно загружен и проверен'
        })
        return
      } catch (err) {
        lastError = err
        console.warn(`Mirror ${candidate.name} failed: ${err.message}`)
        if (i < candidates.length - 1) {
          onProgress({
            stage: 'yt-dlp',
            percent: 10,
            message: `Сбой источника «${candidate.name}», переключение на резервное зеркало...`
          })
        }
      }
    }

    // If all direct links & mirrors failed, try GitHub API as a last resort
    try {
      onProgress({ stage: 'yt-dlp', percent: 15, message: 'Проверка GitHub API...' })
      const releaseInfo = await this._fetchJson('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest')
      const asset = releaseInfo?.assets?.find((a) => a.name === assetName)
      if (asset?.browser_download_url) {
        await this._downloadFileWithRedirects(
          asset.browser_download_url,
          this._ytDlpDefault,
          ({ percent, downloadedMB, totalMB, speedMBs }) => {
            const sizeInfo = totalMB ? ` (${downloadedMB} / ${totalMB} МБ • ${speedMBs} МБ/с)` : ` (${downloadedMB} МБ)`
            onProgress({
              stage: 'yt-dlp',
              percent,
              message: `Загрузка yt-dlp... ${percent}%${sizeInfo}`
            })
          }
        )
        return
      }
    } catch {}

    throw new Error(
      `Не удалось загрузить yt-dlp ни с одного зеркала: ${lastError?.message || 'Ошибка соединения'}. ` +
      `Вы можете указать путь к yt-dlp.exe вручную кнопкой «Обзор».`
    )
  }

  // ─── Private: HTTP & Stream Helpers ─────────────────────────────────────────
  _fetchJson(url) {
    return new Promise((resolve, reject) => {
      const opts = { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) YT-DLP-Client/1.0' } }
      const getter = url.startsWith('http:') ? httpGet : httpsGet
      const req = getter(url, opts, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, url).toString()
          return this._fetchJson(redirectUrl).then(resolve).catch(reject)
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`))
        }
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch {
            reject(new Error('Не удалось распарсить JSON'))
          }
        })
      })
      req.on('error', reject)
      req.setTimeout(15000, () => {
        req.destroy(new Error('Превышен таймаут ответа сервера'))
      })
    })
  }

  _downloadFileWithRedirects(initialUrl, destPath, onProgress, maxRedirects = 10, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const tempPath = `${destPath}.tmp_${Date.now()}`
      let fileStream = null
      let activeReq = null
      let isAborted = false

      const cleanup = () => {
        if (fileStream) {
          try { fileStream.close() } catch {}
          fileStream = null
        }
        if (existsSync(tempPath)) {
          try { unlinkSync(tempPath) } catch {}
        }
      }

      const fail = (err) => {
        if (isAborted) return
        isAborted = true
        if (activeReq) {
          try { activeReq.destroy() } catch {}
        }
        cleanup()
        reject(err)
      }

      let redirectCount = 0

      const makeRequest = (currentUrl) => {
        if (redirectCount > maxRedirects) {
          return fail(new Error('Слишком много перенаправлений (redirect loop)'))
        }

        let parsedUrl
        try {
          parsedUrl = new URL(currentUrl)
        } catch (e) {
          return fail(new Error(`Некорректный URL: ${currentUrl}`))
        }

        const isHttps = parsedUrl.protocol === 'https:'
        const getter = isHttps ? httpsGet : httpGet

        const options = {
          protocol: parsedUrl.protocol,
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*'
          }
        }

        const req = getter(options, (res) => {
          // Handle 3xx Redirects
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            redirectCount++
            const nextUrl = new URL(res.headers.location, currentUrl).toString()
            res.resume() // consume stream
            return makeRequest(nextUrl)
          }

          if (res.statusCode < 200 || res.statusCode >= 300) {
            res.resume()
            return fail(new Error(`Сервер вернул код ошибки HTTP ${res.statusCode}`))
          }

          const totalBytes = parseInt(res.headers['content-length'] || '0', 10)
          let downloadedBytes = 0
          let lastProgressTime = Date.now()
          let bytesSinceLastCalc = 0
          let currentSpeedMBs = '0.0'

          fileStream = createWriteStream(tempPath)

          res.on('data', (chunk) => {
            downloadedBytes += chunk.length
            bytesSinceLastCalc += chunk.length

            const now = Date.now()
            const deltaMs = now - lastProgressTime

            if (deltaMs >= 300) {
              const speedBytesPerSec = (bytesSinceLastCalc / deltaMs) * 1000
              currentSpeedMBs = (speedBytesPerSec / (1024 * 1024)).toFixed(1)
              lastProgressTime = now
              bytesSinceLastCalc = 0

              const percent = totalBytes > 0 ? Math.min(99, Math.round((downloadedBytes / totalBytes) * 100)) : 50
              const downloadedMB = (downloadedBytes / (1024 * 1024)).toFixed(1)
              const totalMB = totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(1) : null

              if (typeof onProgress === 'function') {
                onProgress({ percent, downloadedMB, totalMB, speedMBs: currentSpeedMBs })
              }
            }
          })

          res.pipe(fileStream)

          fileStream.on('finish', () => {
            fileStream.close(() => {
              fileStream = null
              try {
                // Verify downloaded file exists and is not an empty error response
                if (!existsSync(tempPath)) {
                  return fail(new Error('Временный файл не сохранился на диске'))
                }
                const stats = statSync(tempPath)
                if (stats.size < 500 * 1024) {
                  return fail(new Error(`Загруженный файл поврежден или слишком мал (${stats.size} байт)`))
                }

                // If target already exists, remove it before renaming
                if (existsSync(destPath)) {
                  try { unlinkSync(destPath) } catch {}
                }

                renameSync(tempPath, destPath)

                if (this.os !== 'win32') {
                  try { chmodSync(destPath, '755') } catch {}
                }

                resolve()
              } catch (renameErr) {
                fail(renameErr)
              }
            })
          })

          fileStream.on('error', (err) => fail(err))
          res.on('error', (err) => fail(err))
        })

        req.on('error', (err) => fail(err))
        req.setTimeout(timeoutMs, () => {
          req.destroy(new Error(`Превышен таймаут соединения (${Math.round(timeoutMs / 1000)}с)`))
        })

        activeReq = req
      }

      makeRequest(initialUrl)
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

  async updateYtDlp(onProgress) {
    const ytdlpPath = this.getYtDlpPath()
    if (ytdlpPath && existsSync(ytdlpPath)) {
      try {
        const { stdout } = await execAsync(`"${ytdlpPath}" --update`, { timeout: 45000, windowsHide: true })
        this.invalidateCache()
        return { success: true, message: stdout.trim() }
      } catch (err) {
        // Fallback: If yt-dlp --update fails, re-download the latest binary directly
        try {
          if (typeof onProgress === 'function') {
            onProgress({ stage: 'yt-dlp', percent: 10, message: 'Обновление через прямое скачивание...' })
          }
          await this._downloadYtDlp(onProgress || (() => {}))
          this.invalidateCache()
          return { success: true, message: 'yt-dlp успешно обновлен до последней версии' }
        } catch (downloadErr) {
          return { success: false, error: `${err.message} (${downloadErr.message})` }
        }
      }
    }
    return { success: false, error: 'yt-dlp не найден на диске' }
  }
}

export { BinaryManager }
