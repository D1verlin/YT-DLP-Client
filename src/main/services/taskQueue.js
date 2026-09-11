import { spawn } from 'child_process'
import { join, dirname } from 'path'
import { existsSync, unlinkSync } from 'fs'
import { Notification, shell } from 'electron'
import {
  parseProgress,
  parseDestination,
  parseAlreadyDownloaded,
  parsePlaylistItem,
  parsePlaylistTitle,
  parseMerging,
  parseMergeDestination,
  isFragmentPath
} from '../utils/progressParser'

function generateId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
}

class TaskQueue {
  constructor(binaryManager, store) {
    this.binaryManager = binaryManager
    this.store = store
    this.tasks = new Map()
    this.processes = new Map()
    this.progressCallback = null
    this.taskUpdateCallback = null
    this.maxConcurrent = store.getSetting('concurrency') || 3

    // Restore saved tasks from disk
    const saved = this.store.getSavedTasks() || []
    for (const t of saved) {
      if (t.status === 'downloading' || t.status === 'paused') {
        t.status = 'cancelled'
      }
      this.tasks.set(t.id, t)
    }
  }

  _saveTasks() {
    try {
      const list = Array.from(this.tasks.values())
      this.store.saveTasks(list)
    } catch (err) {
      console.error('Failed to save tasks:', err.message)
    }
  }

  setProgressCallback(cb) { this.progressCallback = cb }
  setTaskUpdateCallback(cb) { this.taskUpdateCallback = cb }

  addTask(options) {
    const id = generateId()
    const task = {
      id,
      url: options.url,
      title: options.title,
      thumbnail: options.thumbnail,
      duration: options.duration,
      config: options.config,
      entries: Array.isArray(options.entries)
        ? options.entries
        : (Array.isArray(options.config?.entries) ? options.config.entries : []),
      status: 'pending',
      progress: 0,
      speed: '',
      eta: '',
      totalSize: '',
      filePath: null,
      streamLabel: '',
      playlistCurrent: null,
      playlistTotal: null,
      playlistTitle: null,
      errorMessage: null,
      errorLog: [],
      createdAt: new Date().toISOString()
    }
    this.tasks.set(id, task)
    this._saveTasks()
    this._notifyTaskUpdate({ ...task })
    this._processQueue()
    return task
  }

  _getRunningCount() {
    let n = 0
    for (const t of this.tasks.values()) if (t.status === 'downloading') n++
    return n
  }

  _getPendingTasks() {
    const arr = []
    for (const t of this.tasks.values()) if (t.status === 'pending') arr.push(t)
    return arr
  }

  _processQueue() {
    while (this._getRunningCount() < this.maxConcurrent) {
      const pending = this._getPendingTasks()
      if (!pending.length) break
      this._startDownload(pending[0])
    }
  }

  _startDownload(task) {
    task.status = 'downloading'
    this._saveTasks()
    this._notifyTaskUpdate({ ...task })

    const settings = this.store.getSettings()
    const ytDlpPath = this.binaryManager.getYtDlpPath()
    const ffmpegPath = this.binaryManager.getFfmpegPath()
    const args = this._buildArgs(task, settings, ffmpegPath)

    let proc
    try {
      proc = spawn(ytDlpPath, args, {
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          LC_ALL: 'C.UTF-8',
          LANG: 'C.UTF-8'
        },
        windowsHide: true
      })
      proc.stdout.setEncoding('utf8')
      proc.stderr.setEncoding('utf8')
    } catch (err) {
      task.status = 'error'
      task.errorMessage = err.message
      this._saveTasks()
      this._notifyTaskUpdate({ ...task })
      this._processQueue()
      return
    }

    this.processes.set(task.id, proc)

    let buffer = ''
    let lastProgressAt = 0
    let streamIndex = 0
    let destCount = 0
    let totalStreams = (task.config && task.config.format === 'audio') ? 1 : 2
    let isMerging = false

    proc.stdout.on('data', (data) => {
      buffer += data.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        // Playlist item tracking
        const playlistItem = parsePlaylistItem(line)
        if (playlistItem) {
          task.playlistCurrent = playlistItem.current
          task.playlistTotal = playlistItem.total
          task.streamLabel = `Track ${playlistItem.current} / ${playlistItem.total}`

          if (task.entries && task.entries.length > 0) {
            const currentIdx = playlistItem.current - 1
            task.entries.forEach((entry, i) => {
              if (i < currentIdx) {
                if (entry.status !== 'completed') {
                  entry.status = 'completed'
                  entry.progress = 100
                }
              } else if (i === currentIdx) {
                if (entry.status !== 'completed') {
                  entry.status = 'downloading'
                }
              } else {
                if (entry.status !== 'completed') {
                  entry.status = 'pending'
                  entry.progress = 0
                }
              }
            })
          }
        }

        const playlistTitle = parsePlaylistTitle(line)
        if (playlistTitle) {
          task.playlistTitle = playlistTitle
        }

        const dest = parseDestination(line)
        if (dest && !isFragmentPath(dest)) {
          task.filePath = dest
          if (destCount > 0) streamIndex = Math.min(streamIndex + 1, totalStreams - 1)
          destCount++

          if (task.entries && task.entries.length > 0 && task.playlistCurrent) {
            const currentIdx = task.playlistCurrent - 1
            if (task.entries[currentIdx]) {
              task.entries[currentIdx].filePath = dest
            }
          }
        }

        const mergeDest = parseMergeDestination(line)
        if (mergeDest) {
          task.filePath = mergeDest
          if (task.entries && task.entries.length > 0 && task.playlistCurrent) {
            const currentIdx = task.playlistCurrent - 1
            if (task.entries[currentIdx]) {
              task.entries[currentIdx].filePath = mergeDest
            }
          }
        }

        if (parseMerging(line)) {
          isMerging = true
          task.streamLabel = 'Merging...'
          this._notifyProgress(task)
        }

        const alreadyPath = parseAlreadyDownloaded(line)
        if (alreadyPath) {
          if (task.config?.isPlaylist) {
            if (task.entries && task.entries.length > 0 && task.playlistCurrent) {
              const currentIdx = task.playlistCurrent - 1
              if (task.entries[currentIdx]) {
                task.entries[currentIdx].status = 'completed'
                task.entries[currentIdx].progress = 100
                task.entries[currentIdx].filePath = alreadyPath
              }
            }
            task.filePath = alreadyPath
          } else {
            task.progress = 100
            task.status = 'completed'
            task.streamLabel = ''
            task.filePath = alreadyPath
            this._saveTasks()
            this._notifyTaskUpdate({ ...task })
            this._processQueue()
            return
          }
        }

        const progress = parseProgress(line)
        const now = Date.now()
        if (progress && now - lastProgressAt > 150) {
          lastProgressAt = now
          isMerging = false

          if (task.entries && task.entries.length > 0 && task.playlistCurrent) {
            const currentIdx = task.playlistCurrent - 1
            if (task.entries[currentIdx] && task.entries[currentIdx].status !== 'completed') {
              task.entries[currentIdx].progress = progress.percent
              task.entries[currentIdx].status = 'downloading'
            }
          }

          let unified
          if (task.config?.isPlaylist && task.playlistTotal) {
            const itemPercent = (progress.percent || 0) / task.playlistTotal
            const basePercent = (((task.playlistCurrent || 1) - 1) / task.playlistTotal) * 100
            unified = Math.min(100, basePercent + itemPercent)
          } else if (totalStreams === 1) {
            unified = progress.percent
            task.streamLabel = ''
          } else {
            const sliceSize = 100 / totalStreams
            unified = sliceSize * streamIndex + (progress.percent * sliceSize) / 100
            task.streamLabel = streamIndex === 0 ? 'Video' : 'Audio'
          }

          task.progress = unified
          task.speed = progress.speed
          task.eta = progress.eta
          task.totalSize = progress.totalSize
          this._notifyProgress(task)
        }
      }
    })

    proc.stderr.on('data', (data) => {
      const text = data.toString()
      if (!task.errorLog) task.errorLog = []
      for (const line of text.split('\n')) {
        const trimmed = line.trim()
        if (trimmed) {
          task.errorLog.push(trimmed)
          if (task.errorLog.length > 100) task.errorLog.shift()
        }

        const dest = parseDestination(line)
        if (dest && !isFragmentPath(dest)) {
          task.filePath = dest
          if (destCount > 0) streamIndex = Math.min(streamIndex + 1, totalStreams - 1)
          destCount++
          if (task.entries && task.entries.length > 0 && task.playlistCurrent) {
            const currentIdx = task.playlistCurrent - 1
            if (task.entries[currentIdx]) {
              task.entries[currentIdx].filePath = dest
            }
          }
        }
        const mergeDest = parseMergeDestination(line)
        if (mergeDest) {
          task.filePath = mergeDest
          if (task.entries && task.entries.length > 0 && task.playlistCurrent) {
            const currentIdx = task.playlistCurrent - 1
            if (task.entries[currentIdx]) {
              task.entries[currentIdx].filePath = mergeDest
            }
          }
        }
      }
      console.error(`[task:${task.id}] ${text.trim()}`)
    })

    proc.on('close', (code) => {
      this.processes.delete(task.id)
      if (task.status === 'cancelled') {
        this._saveTasks()
        this._notifyTaskUpdate({ ...task })
        this._processQueue()
        return
      }
      if (code === 0) {
        task.status = 'completed'
        task.progress = 100
        task.streamLabel = ''

        if (task.entries && task.entries.length > 0) {
          task.entries.forEach((entry) => {
            entry.status = 'completed'
            entry.progress = 100
          })
        }

        // On Complete: Notification, Sound, Auto-Open
        try {
          const currentSettings = this.store.getSettings()
          if (currentSettings.notifyOnComplete && Notification.isSupported()) {
            const notif = new Notification({
              title: 'YT-DLP Client',
              body: `✓ Загрузка завершена: ${task.title || 'Файл готов'}`
            })
            notif.on('click', () => {
              if (task.filePath && existsSync(task.filePath)) {
                shell.showItemInFolder(task.filePath)
              }
            })
            notif.show()
          }
          if (currentSettings.soundOnComplete) {
            shell.beep()
          }
          if (currentSettings.autoOpenFolder && task.filePath && existsSync(task.filePath)) {
            shell.showItemInFolder(task.filePath)
          }
        } catch (e) {
          console.error('Notification/Sound error:', e)
        }
      } else {
        task.status = 'error'
        if (!task.errorMessage && task.errorLog && task.errorLog.length > 0) {
          const errLine = task.errorLog.find((l) => l.startsWith('ERROR:')) || task.errorLog[task.errorLog.length - 1]
          task.errorMessage = (errLine || 'Ошибка загрузки').replace(/^ERROR:\s*/, '')
        }
      }
      this._saveTasks()
      this._notifyTaskUpdate({ ...task })
      this._processQueue()
    })
  }

  _buildArgs(task, settings, ffmpegPath) {
    const args = []
    const config = task.config || {}

    // Force UTF-8 encoding in yt-dlp
    args.push('--encoding', 'utf-8')

    // Format, Codec & Bitrate handling
    if (config.format === 'audio') {
      const audioFormat = config.audioFormat || settings.preferredAudioFormat || 'mp3'
      const audioBitrate = config.audioBitrate || '320k'
      args.push('-f', 'ba/b', '-x', '--audio-format', audioFormat)
      if (audioBitrate && audioBitrate !== 'best') {
        args.push('--audio-quality', audioBitrate)
      }
    } else {
      const container = config.videoContainer || settings.preferredVideoFormat || 'mp4'
      const quality = config.quality || 'best'
      const codec = config.videoCodec || 'default'

      if (codec === 'h264') {
        if (quality === 'best') {
          args.push('-f', 'bv*[vcodec^=avc1]+ba[acodec^=mp4a]/bv*[vcodec^=avc1]+ba/b[vcodec^=avc1]/bv*+ba/b')
        } else {
          args.push('-f', `bv*[vcodec^=avc1][height<=?${quality}]+ba[acodec^=mp4a]/bv*[vcodec^=avc1][height<=?${quality}]+ba/bv*[height<=?${quality}]+ba/b[height<=?${quality}]/bv*+ba/b`)
        }
      } else if (codec === 'av1') {
        if (quality === 'best') {
          args.push('-f', 'bv*[vcodec^=av01]+ba/bv*+ba/b')
        } else {
          args.push('-f', `bv*[vcodec^=av01][height<=?${quality}]+ba/bv*[height<=?${quality}]+ba/b[height<=?${quality}]/bv*+ba/b`)
        }
      } else {
        if (quality === 'best') {
          args.push('-f', 'bv*+ba/b')
        } else {
          args.push('-f', `bv*[height<=?${quality}]+ba/b[height<=?${quality}]/bv*+ba/b`)
        }
      }
      args.push('--merge-output-format', container)
    }

    // Subtitles
    const subs = config.subtitles || settings.embedSubs
    if (subs && subs !== 'none') {
      args.push('--write-subs', '--embed-subs')
      if (subs === 'ru') args.push('--sub-langs', 'ru,ru-orig')
      else if (subs === 'en') args.push('--sub-langs', 'en,en-orig')
      else if (subs === 'all') args.push('--sub-langs', 'all')
    }

    // Time trimming section (e.g. *00:01:10-00:02:30)
    if (config.timeRange && config.timeRange.trim()) {
      args.push('--download-sections', config.timeRange.trim())
    }

    // FFmpeg directory
    const ffmpegDir = dirname(ffmpegPath)
    args.push('--ffmpeg-location', ffmpegDir)

    // Output template & playlist folder structure
    let outputPath
    if (config.isPlaylist) {
      args.push('--yes-playlist')
      if (config.playlistItems) {
        args.push('--playlist-items', String(config.playlistItems))
      }
      const itemTemplate = settings.nameTemplate || '%(playlist_index)02d - %(title)s.%(ext)s'
      outputPath = join(settings.downloadPath, '%(playlist_title,playlist)s', itemTemplate)
    } else {
      args.push('--no-playlist')
      const template = settings.nameTemplate || '%(title)s.%(ext)s'
      outputPath = join(settings.downloadPath, template)
    }
    args.push('-o', outputPath)

    // Network & Connection Settings
    if (settings.limitRate) args.push('--limit-rate', settings.limitRate)
    if (settings.proxy) args.push('--proxy', settings.proxy)
    if (settings.retries) args.push('--retries', String(settings.retries))
    if (settings.socketTimeout) args.push('--socket-timeout', String(settings.socketTimeout))
    if (settings.customUserAgent) args.push('--user-agent', settings.customUserAgent)

    // Multi-fragment concurrent download acceleration
    args.push('--concurrent-fragments', '4')

    // Cookies
    if (settings.cookiesFromBrowser && settings.cookiesFromBrowser.trim()) {
      args.push('--cookies-from-browser', settings.cookiesFromBrowser.trim())
    } else if (settings.cookiesFilePath && settings.cookiesFilePath.trim()) {
      args.push('--cookies', settings.cookiesFilePath.trim())
    }

    // Metadata & thumbnail
    if (settings.embedThumbnail) args.push('--embed-thumbnail')
    if (settings.addMetadata) args.push('--add-metadata')

    // Custom extra arguments
    if (settings.extraArgs && settings.extraArgs.trim()) {
      const extraParts = settings.extraArgs.trim().match(/(?:[^\s"]+|"[^"]*")+/g) || []
      for (const part of extraParts) {
        const clean = part.replace(/^"|"$/g, '')
        if (clean) args.push(clean)
      }
    }

    // Continue on non-fatal errors
    args.push('--no-abort-on-error')
    args.push('--newline')
    args.push(task.url)

    return args
  }

  cancelTask(id) {
    const task = this.tasks.get(id)
    if (!task) return false
    task.status = 'cancelled'
    const proc = this.processes.get(id)
    if (proc) {
      try { proc.kill('SIGKILL') } catch { proc.kill() }
      this.processes.delete(id)
    }
    this._saveTasks()
    this._notifyTaskUpdate({ ...task })
    return true
  }

  retryTask(id) {
    const task = this.tasks.get(id)
    if (!task) return false
    task.status = 'pending'
    task.progress = 0
    task.speed = ''
    task.eta = ''
    task.errorMessage = null
    task.errorLog = []
    if (task.entries && task.entries.length > 0) {
      task.entries.forEach((entry) => {
        entry.status = 'pending'
        entry.progress = 0
      })
    }
    this._saveTasks()
    this._notifyTaskUpdate({ ...task })
    this._processQueue()
    return true
  }

  removeTask(id, deleteFile = false) {
    const task = this.tasks.get(id)
    if (!task) return false
    if (task.status === 'downloading') {
      this.cancelTask(id)
    }
    if (deleteFile && task.filePath && existsSync(task.filePath)) {
      try {
        unlinkSync(task.filePath)
      } catch (err) {
        console.error(`Failed to delete file ${task.filePath}:`, err.message)
      }
    }
    this.tasks.delete(id)
    this._saveTasks()
    return true
  }

  syncFiles() {
    let changed = false
    for (const [id, task] of this.tasks.entries()) {
      if (task.status === 'completed' && task.filePath) {
        if (!existsSync(task.filePath)) {
          this.tasks.delete(id)
          changed = true
        }
      }
    }
    if (changed) {
      this._saveTasks()
    }
    return { changed, tasks: this.getTasks() }
  }

  clearCompleted() {
    for (const [id, task] of this.tasks.entries()) {
      if (task.status === 'completed' || task.status === 'cancelled') {
        this.tasks.delete(id)
      }
    }
    this._saveTasks()
    return true
  }

  getTasks() {
    return Array.from(this.tasks.values())
  }

  _notifyProgress(task) {
    if (this.progressCallback) {
      this.progressCallback({
        id: task.id,
        progress: task.progress,
        speed: task.speed,
        eta: task.eta,
        totalSize: task.totalSize,
        streamLabel: task.streamLabel || '',
        filePath: task.filePath || null,
        playlistCurrent: task.playlistCurrent || null,
        playlistTotal: task.playlistTotal || null,
        playlistTitle: task.playlistTitle || null,
        entries: task.entries || []
      })
    }
  }

  _notifyTaskUpdate(task) {
    if (this.taskUpdateCallback) this.taskUpdateCallback(task)
  }
}

export { TaskQueue }

