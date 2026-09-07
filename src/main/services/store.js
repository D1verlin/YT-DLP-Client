import Store from 'electron-store'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, writeFileSync, readFileSync } from 'fs'

class AppStore {
  constructor() {
    this.defaults = {
      downloadPath: app.getPath('downloads'),
      language: 'en',
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
      customFfmpegPath: '',
      firstRun: true
    }

    this.store = new Store({
      defaults: this.defaults
    })

    this.tasksPath = join(app.getPath('userData'), 'tasks.json')
    this._initTasks()
  }

  _initTasks() {
    if (!existsSync(this.tasksPath)) {
      writeFileSync(this.tasksPath, JSON.stringify([]))
    }
  }

  getSettings() {
    return this.store.store
  }

  saveSettings(settings) {
    Object.entries(settings).forEach(([key, value]) => {
      this.store.set(key, value)
    })
    return this.getSettings()
  }

  resetSettings() {
    this.store.clear()
    Object.entries(this.defaults).forEach(([key, value]) => {
      this.store.set(key, value)
    })
    return this.getSettings()
  }

  getSetting(key) {
    return this.store.get(key)
  }

  isFirstRun() {
    return this.store.get('firstRun', true)
  }

  completeFirstRun() {
    this.store.set('firstRun', false)
  }

  resetFirstRun() {
    this.store.set('firstRun', true)
    return { success: true }
  }

  getSavedTasks() {
    try {
      if (existsSync(this.tasksPath)) {
        return JSON.parse(readFileSync(this.tasksPath, 'utf-8'))
      }
      return []
    } catch {
      return []
    }
  }

  saveTasks(tasks) {
    try {
      writeFileSync(this.tasksPath, JSON.stringify(tasks, null, 2))
    } catch (err) {
      console.error('Failed to write tasks:', err.message)
    }
  }
}

export { AppStore }
