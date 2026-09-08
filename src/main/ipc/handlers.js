import { ipcMain, dialog, app, shell } from 'electron'
import { exec } from 'child_process'
import { normalize, resolve, dirname } from 'path'
import { existsSync, statSync } from 'fs'

function registerIpcHandlers(mainWindow, store, binaryManager, taskQueue) {
  // ─── Binaries ─────────────────────────────────────────────────────────────
  ipcMain.handle('binaries:check', () => ({
    ready: binaryManager.areBinariesReady(),
    firstRun: store.isFirstRun()
  }))

  ipcMain.handle('binaries:download', async () => {
    return binaryManager.downloadBinaries((progress) => {
      mainWindow.webContents.send('binaries:progress', progress)
    })
  })

  ipcMain.handle('binaries:info', (_, forceRefresh) => binaryManager.getBinaryInfo(forceRefresh))
  ipcMain.handle('binaries:update', () => binaryManager.updateYtDlp((progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('binaries:progress', progress)
  }))
  ipcMain.handle('binaries:setCustomYtDlp', (_, filePath) => {
    const ok = binaryManager.setCustomYtDlp(filePath)
    return { success: ok }
  })
  ipcMain.handle('binaries:setCustomFfmpeg', (_, filePath) => {
    const ok = binaryManager.setCustomFfmpeg(filePath)
    return { success: ok }
  })

  ipcMain.handle('setup:complete', () => {
    store.completeFirstRun()
    return { success: true }
  })

  ipcMain.handle('setup:isFirstRun', () => {
    return store.isFirstRun()
  })

  ipcMain.handle('setup:reset', () => {
    return store.resetFirstRun()
  })

  // ─── DevTools / Debug Console ───────────────────────────────────────────────
  ipcMain.handle('devtools:toggle', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.toggleDevTools()
      return { success: true, isOpen: mainWindow.webContents.isDevToolsOpened() }
    }
    return { success: false }
  })

  ipcMain.handle('devtools:open', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.openDevTools()
      return { success: true }
    }
    return { success: false }
  })

  ipcMain.handle('devtools:close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.closeDevTools()
      return { success: true }
    }
    return { success: false }
  })

  // ─── URL Analysis ──────────────────────────────────────────────────────────
  ipcMain.handle('url:analyze', (_, url) => {
    return new Promise((resolveResult) => {
      const ytDlpPath = binaryManager.getYtDlpPath()
      const settings = store.getSettings()

      const extraFlags = []
      if (settings.cookiesFromBrowser && settings.cookiesFromBrowser.trim()) {
        extraFlags.push(`--cookies-from-browser "${settings.cookiesFromBrowser.trim()}"`)
      } else if (settings.cookiesFilePath && settings.cookiesFilePath.trim()) {
        extraFlags.push(`--cookies "${settings.cookiesFilePath.trim()}"`)
      }

      const flagsStr = extraFlags.length ? ` ${extraFlags.join(' ')}` : ''
      const cmd = `"${ytDlpPath}" --dump-single-json --no-warnings --flat-playlist${flagsStr} "${url}"`

      exec(
        cmd,
        {
          maxBuffer: 25 * 1024 * 1024,
          timeout: 60000,
          env: {
            ...process.env,
            PYTHONIOENCODING: 'utf-8',
            LC_ALL: 'C.UTF-8',
            LANG: 'C.UTF-8'
          },
          windowsHide: true
        },
        (error, stdout, stderr) => {
          if (error) {
            const errLine = stderr
              ? stderr.split('\n').find((l) => l.startsWith('ERROR:')) || stderr.split('\n')[0]
              : error.message
            resolveResult({ success: false, error: (errLine || 'Ошибка анализа URL').replace(/^ERROR:\s*/, '') })
            return
          }
          try {
            const data = JSON.parse(stdout)
            const isPlaylist = data._type === 'playlist' || Array.isArray(data.entries)

            if (isPlaylist) {
              const entries = data.entries || []
              const thumbnails = data.thumbnails || []
              const firstEntryThumb = entries[0]?.thumbnails?.[entries[0]?.thumbnails?.length - 1]?.url || entries[0]?.thumbnail || null
              const thumbnail = (thumbnails[thumbnails.length - 1] || {}).url || firstEntryThumb || data.thumbnail || null
              const totalDuration = entries.reduce((acc, e) => acc + (e.duration || 0), 0)

              resolveResult({
                success: true,
                data: {
                  isPlaylist: true,
                  playlistCount: entries.length || data.playlist_count || 0,
                  title: data.title || data.playlist_title || '',
                  thumbnail,
                  duration: totalDuration,
                  uploader: data.uploader || data.channel || entries[0]?.uploader || '',
                  viewCount: data.view_count || null,
                  platform: data.extractor_key || data.extractor || 'Playlist',
                  description: data.description ? (data.description.length > 250 ? data.description.substring(0, 250) + '...' : data.description) : '',
                  entries: entries.slice(0, 300).map((e, idx) => ({
                    index: idx + 1,
                    id: e.id,
                    title: e.title,
                    duration: e.duration,
                    uploader: e.uploader || e.channel || ''
                  })),
                  videoQualities: [
                    { label: '1080p Full HD', value: '1080' },
                    { label: '720p HD', value: '720' },
                    { label: '480p SD', value: '480' }
                  ],
                  hasAudio: true
                }
              })
              return
            }

            // Single Video
            const formats = data.formats || []
            const heights = [
              ...new Set(
                formats
                  .filter((f) => f.vcodec && f.vcodec !== 'none' && f.height)
                  .map((f) => f.height)
                  .sort((a, b) => b - a)
              )
            ]
            const videoQualities = heights.map((h) => ({
              label: h >= 2160 ? `4K (${h}p)` : h >= 1440 ? `2K (${h}p)` : h >= 1080 ? `1080p Full HD` : `${h}p`,
              value: String(h)
            }))

            const thumbnails = data.thumbnails || []
            const thumbnail =
              (thumbnails[thumbnails.length - 1] || {}).url || data.thumbnail || null

            // Formatted upload date if available (YYYYMMDD -> DD.MM.YYYY)
            let uploadDate = null
            if (data.upload_date && data.upload_date.length === 8) {
              const y = data.upload_date.slice(0, 4)
              const m = data.upload_date.slice(4, 6)
              const d = data.upload_date.slice(6, 8)
              uploadDate = `${d}.${m}.${y}`
            }

            resolveResult({
              success: true,
              data: {
                isPlaylist: false,
                title: data.title,
                thumbnail,
                duration: data.duration,
                uploader: data.uploader || data.channel || data.creator || data.artist || '',
                uploaderUrl: data.uploader_url || data.channel_url || null,
                viewCount: data.view_count || null,
                likeCount: data.like_count || null,
                uploadDate,
                fps: data.fps || null,
                filesizeApprox: data.filesize_approx || data.filesize || null,
                platform: data.extractor_key || data.extractor || 'Web',
                tags: Array.isArray(data.tags) ? data.tags.slice(0, 5) : [],
                description: data.description ? (data.description.length > 250 ? data.description.substring(0, 250) + '...' : data.description) : '',
                videoQualities,
                hasAudio: formats.some((f) => f.acodec && f.acodec !== 'none')
              }
            })
          } catch {
            resolveResult({ success: false, error: 'Не удалось распарсить информацию о видео' })
          }
        }
      )
    })
  })

  // ─── Downloads ────────────────────────────────────────────────────────────
  taskQueue.setProgressCallback((data) => {
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send('download:progress', data)
  })
  taskQueue.setTaskUpdateCallback((data) => {
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send('task:update', data)
  })

  ipcMain.handle('download:start', (_, options) => {
    const task = taskQueue.addTask(options)
    return { success: true, task }
  })
  ipcMain.handle('download:pause', (_, id) => ({ success: taskQueue.pauseTask(id) }))
  ipcMain.handle('download:resume', (_, id) => ({ success: taskQueue.resumeTask(id) }))
  ipcMain.handle('download:cancel', (_, id) => ({ success: taskQueue.cancelTask(id) }))
  ipcMain.handle('download:retry', (_, id) => ({ success: taskQueue.retryTask(id) }))
  ipcMain.handle('download:remove', (_, id) => ({ success: taskQueue.removeTask(id) }))
  ipcMain.handle('download:pauseAll', () => ({ success: taskQueue.pauseAll() }))
  ipcMain.handle('download:resumeAll', () => ({ success: taskQueue.resumeAll() }))
  ipcMain.handle('download:clearCompleted', () => ({ success: taskQueue.clearCompleted() }))
  ipcMain.handle('tasks:get', () => taskQueue.getTasks())
  ipcMain.handle('tasks:syncFiles', () => taskQueue.syncFiles())

  // ─── Settings ─────────────────────────────────────────────────────────────
  ipcMain.handle('settings:get', () => store.getSettings())
  ipcMain.handle('settings:save', (_, settings) => {
    binaryManager.invalidateCache()
    return store.saveSettings(settings)
  })
  ipcMain.handle('settings:reset', () => {
    binaryManager.invalidateCache()
    return store.resetSettings()
  })

  // ─── Dialog ───────────────────────────────────────────────────────────────
  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:selectFile', async (_, filters) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: filters || []
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // ─── Window Controls ──────────────────────────────────────────────────────
  ipcMain.handle('window:minimize', () => mainWindow.minimize())
  ipcMain.handle('window:maximize', () => {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
  })
  ipcMain.handle('window:close', () => mainWindow.close())

  // ─── App Info ─────────────────────────────────────────────────────────────
  ipcMain.handle('app:version', () => app.getVersion())

  // ─── Shell ────────────────────────────────────────────────────────────────
  ipcMain.handle('shell:openPath', async (_, filePath) => {
    if (!filePath) return { success: false, error: 'Файл не указан' }
    try {
      const normalizedPath = normalize(resolve(filePath))
      if (!existsSync(normalizedPath)) {
        return { success: false, error: 'Файл не найден на диске' }
      }
      const err = await shell.openPath(normalizedPath)
      return { success: !err, error: err || null }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('shell:showInFolder', (_, filePath) => {
    try {
      if (filePath) {
        const normalizedPath = normalize(resolve(filePath))
        if (existsSync(normalizedPath)) {
          try {
            if (statSync(normalizedPath).isDirectory()) {
              shell.openPath(normalizedPath)
              return { success: true }
            }
          } catch {}
          shell.showItemInFolder(normalizedPath)
          return { success: true }
        }
        const parentDir = dirname(normalizedPath)
        if (existsSync(parentDir)) {
          shell.openPath(parentDir)
          return { success: true }
        }
      }
      const settings = store.getSettings()
      if (settings.downloadPath && existsSync(settings.downloadPath)) {
        shell.openPath(normalize(resolve(settings.downloadPath)))
        return { success: true }
      }
      return { success: false, error: 'Папка не найдена' }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('shell:openFolder', (_, folderPath) => {
    try {
      const target = folderPath || store.getSettings()?.downloadPath
      if (target) {
        const normalizedPath = normalize(resolve(target))
        if (existsSync(normalizedPath)) {
          shell.openPath(normalizedPath)
          return { success: true }
        }
      }
      return { success: false, error: 'Папка не найдена' }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('shell:openExternal', async (_, url) => {
    if (!url) return { success: false }
    try {
      await shell.openExternal(url)
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })
}

export { registerIpcHandlers }

