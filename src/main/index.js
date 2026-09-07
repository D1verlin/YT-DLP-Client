import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpcHandlers } from './ipc/handlers'
import { AppStore } from './services/store'
import { BinaryManager } from './services/binaryManager'
import { TaskQueue } from './services/taskQueue'

// ─── Debug & DevTools Configuration ──────────────────────────────────────────
// Set OPEN_DEVTOOLS_ON_STARTUP to true to automatically open DevTools when the app starts.
// You can also toggle DevTools at any time by pressing F12 or Ctrl+Shift+I.
const OPEN_DEVTOOLS_ON_STARTUP = false

// Suppress GPU disk-cache permission errors (harmless, occur when cache dir is locked)
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
app.commandLine.appendSwitch('disable-gpu-process-crash-limit')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: false,
    backgroundColor: '#121212',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    if (OPEN_DEVTOOLS_ON_STARTUP) {
      mainWindow.webContents.openDevTools()
    }
  })

  // Keyboard shortcuts: F12 and Ctrl+Shift+I (or Cmd+Opt+I) to toggle DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const isF12 = input.key === 'F12'
    const isCtrlShiftI = (input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i'
    if (isF12 || isCtrlShiftI) {
      mainWindow.webContents.toggleDevTools()
      event.preventDefault()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.ytdlp.client')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const store = new AppStore()
  const binaryManager = new BinaryManager(store)
  const taskQueue = new TaskQueue(binaryManager, store)

  createWindow()
  registerIpcHandlers(mainWindow, store, binaryManager, taskQueue)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
