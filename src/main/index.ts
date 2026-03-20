import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#141414',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
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
  electronApp.setAppUserModelId('com.lumi')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC: open file dialog, read file, return base64
  ipcMain.handle('open-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Books', extensions: ['pdf', 'epub'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    const fileName = filePath.split('/').pop() ?? filePath.split('\\').pop() ?? 'Unknown'
    const buffer = readFileSync(filePath).toString('base64')
    return { filePath, fileName, buffer }
  })

  // IPC: open a file at a known path (for re-opening from bookshelf)
  ipcMain.handle('open-file-by-path', async (_event, filePath: string) => {
    try {
      const fileName = filePath.split('/').pop() ?? filePath.split('\\').pop() ?? 'Unknown'
      const buffer = readFileSync(filePath).toString('base64')
      return { filePath, fileName, buffer }
    } catch {
      return null // file moved or deleted
    }
  })

  // IPC: get app version
  ipcMain.handle('get-app-version', () => app.getVersion())

  // IPC: RAG index persistence (app userData folder)
  const ragDir = join(app.getPath('userData'), 'lumi-rag')
  if (!existsSync(ragDir)) mkdirSync(ragDir, { recursive: true })

  ipcMain.handle('rag-save', (_event, bookHash: string, data: string) => {
    writeFileSync(join(ragDir, `${bookHash}.json`), data, 'utf-8')
  })

  ipcMain.handle('rag-load', (_event, bookHash: string) => {
    const filePath = join(ragDir, `${bookHash}.json`)
    if (!existsSync(filePath)) return null
    return readFileSync(filePath, 'utf-8')
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
