import { app } from 'electron'
import { join, dirname, basename } from 'path'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  copyFileSync,
  unlinkSync,
  rmSync,
  cpSync
} from 'fs'

class PluginManager {
  constructor() {
    const baseDir = app.isPackaged ? dirname(app.getPath('exe')) : app.getAppPath()
    this.pluginsDir = join(baseDir, 'plugins')
    this._ensureDir()
  }

  _ensureDir() {
    try {
      if (!existsSync(this.pluginsDir)) {
        mkdirSync(this.pluginsDir, { recursive: true })
      }
    } catch (err) {
      console.warn(`Could not create plugins dir at ${this.pluginsDir}, falling back to userData/plugins:`, err.message)
      this.pluginsDir = join(app.getPath('userData'), 'plugins')
      if (!existsSync(this.pluginsDir)) {
        mkdirSync(this.pluginsDir, { recursive: true })
      }
    }
  }

  getPluginsDir() {
    return this.pluginsDir
  }

  listPlugins() {
    this._ensureDir()
    try {
      const entries = readdirSync(this.pluginsDir)
      return entries
        .map((name) => {
          const fullPath = join(this.pluginsDir, name)
          try {
            const stat = statSync(fullPath)
            return {
              name,
              fullPath,
              type: stat.isDirectory() ? 'folder' : 'zip',
              size: stat.isDirectory() ? null : stat.size,
              mtime: stat.mtimeMs
            }
          } catch {
            return null
          }
        })
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name))
    } catch {
      return []
    }
  }

  addPlugin(sourcePath) {
    if (!sourcePath || !existsSync(sourcePath)) {
      return { success: false, error: 'Source path does not exist' }
    }

    this._ensureDir()

    try {
      const name = basename(sourcePath)
      const destPath = join(this.pluginsDir, name)

      const stat = statSync(sourcePath)
      if (stat.isDirectory()) {
        // Copy entire folder
        cpSync(sourcePath, destPath, { recursive: true, force: true })
      } else {
        // Copy ZIP file
        copyFileSync(sourcePath, destPath)
      }

      return { success: true, name, destPath }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  removePlugin(name) {
    if (!name) return { success: false, error: 'No plugin name provided' }

    const fullPath = join(this.pluginsDir, name)

    // Security: ensure the path stays inside pluginsDir
    if (!fullPath.startsWith(this.pluginsDir)) {
      return { success: false, error: 'Invalid plugin name' }
    }

    if (!existsSync(fullPath)) {
      return { success: false, error: 'Plugin not found' }
    }

    try {
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        rmSync(fullPath, { recursive: true, force: true })
      } else {
        unlinkSync(fullPath)
      }
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }
}

export { PluginManager }
