import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // Binary management
  checkBinaries: () => ipcRenderer.invoke('binaries:check'),
  getBinaryInfo: (forceRefresh) => ipcRenderer.invoke('binaries:info', forceRefresh),
  updateYtDlp: () => ipcRenderer.invoke('binaries:update'),
  downloadBinaries: () => ipcRenderer.invoke('binaries:download'),
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
  pauseDownload: (id) => ipcRenderer.invoke('download:pause', id),
  resumeDownload: (id) => ipcRenderer.invoke('download:resume', id),
  cancelDownload: (id) => ipcRenderer.invoke('download:cancel', id),
  retryDownload: (id) => ipcRenderer.invoke('download:retry', id),
  removeDownload: (id) => ipcRenderer.invoke('download:remove', id),
  pauseAllDownloads: () => ipcRenderer.invoke('download:pauseAll'),
  resumeAllDownloads: () => ipcRenderer.invoke('download:resumeAll'),
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
  closeWindow: () => ipcRenderer.invoke('window:close'),

  // App info
  getVersion: () => ipcRenderer.invoke('app:version'),

  // Shell
  openFile: (filePath) => ipcRenderer.invoke('shell:openPath', filePath),
  openFolder: (folderPath) => ipcRenderer.invoke('shell:openFolder', folderPath),
  showInFolder: (filePath) => ipcRenderer.invoke('shell:showInFolder', filePath),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url)
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
