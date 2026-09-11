import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // Binary management
  checkBinaries: () => ipcRenderer.invoke('binaries:check'),
  getBinaryInfo: (forceRefresh) => ipcRenderer.invoke('binaries:info', forceRefresh),
  updateYtDlp: () => ipcRenderer.invoke('binaries:update'),
  downloadBinaries: () => ipcRenderer.invoke('binaries:download'),
  downloadFfmpeg: () => ipcRenderer.invoke('binaries:downloadFfmpeg'),
  setCustomYtDlp: (filePath) => ipcRenderer.invoke('binaries:setCustomYtDlp', filePath),
  setCustomFfmpeg: (filePath) => ipcRenderer.invoke('binaries:setCustomFfmpeg', filePath),
  completeSetup: () => ipcRenderer.invoke('setup:complete'),
  isFirstRun: () => ipcRenderer.invoke('setup:isFirstRun'),
  resetFirstRun: () => ipcRenderer.invoke('setup:reset'),
  toggleDevTools: () => ipcRenderer.invoke('devtools:toggle'),
  openDevTools: () => ipcRenderer.invoke('devtools:open'),
  onBinaryProgress: (callback) => {
    const listener = (_, data) => callback(data)
    ipcRenderer.on('binaries:progress', listener)
    return () => ipcRenderer.removeListener('binaries:progress', listener)
  },

  // URL Analysis
  analyzeUrl: (url) => ipcRenderer.invoke('url:analyze', url),

  // Downloads
  startDownload: (options) => ipcRenderer.invoke('download:start', options),
  cancelDownload: (id) => ipcRenderer.invoke('download:cancel', id),
  retryDownload: (id) => ipcRenderer.invoke('download:retry', id),
  removeDownload: (id) => ipcRenderer.invoke('download:remove', id),
  clearCompletedDownloads: () => ipcRenderer.invoke('download:clearCompleted'),
  getTasks: () => ipcRenderer.invoke('tasks:get'),
  syncFiles: () => ipcRenderer.invoke('tasks:syncFiles'),
  onProgress: (callback) => {
    const listener = (_, data) => callback(data)
    ipcRenderer.on('download:progress', listener)
    return () => ipcRenderer.removeListener('download:progress', listener)
  },
  onTaskUpdate: (callback) => {
    const listener = (_, data) => callback(data)
    ipcRenderer.on('task:update', listener)
    return () => ipcRenderer.removeListener('task:update', listener)
  },

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  resetSettings: () => ipcRenderer.invoke('settings:reset'),
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  selectFile: (filters) => ipcRenderer.invoke('dialog:selectFile', filters),

  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  onWindowStateChange: (callback) => {
    const listener = (_, isMax) => callback(isMax)
    ipcRenderer.on('window:maximized-change', listener)
    return () => ipcRenderer.removeListener('window:maximized-change', listener)
  },

  // App info
  getVersion: () => ipcRenderer.invoke('app:version'),

  // Shell
  openFile: (filePath) => ipcRenderer.invoke('shell:openPath', filePath),
  openFolder: (folderPath) => ipcRenderer.invoke('shell:openFolder', folderPath),
  showInFolder: (filePath) => ipcRenderer.invoke('shell:showInFolder', filePath),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  onLinkDropped: (callback) => {
    const listener = (_, url) => callback(url)
    ipcRenderer.on('app:link-dropped', listener)
    return () => ipcRenderer.removeListener('app:link-dropped', listener)
  },

  // OTA App Updates
  checkForAppUpdates: (isSilent) => ipcRenderer.invoke('updater:check', isSilent),
  downloadAppUpdate: () => ipcRenderer.invoke('updater:download'),
  installAppUpdate: () => ipcRenderer.invoke('updater:install'),
  getAppUpdateState: () => ipcRenderer.invoke('updater:getState'),
  onAppUpdateStatus: (callback) => {
    const listener = (_, state) => callback(state)
    ipcRenderer.on('updater:status', listener)
    return () => ipcRenderer.removeListener('updater:status', listener)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
