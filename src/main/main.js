const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 750,
    minWidth: 360,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

// Register protocol for local audio files
app.whenReady().then(() => {
  protocol.registerFileProtocol('local-audio', (request, callback) => {
    const filePath = decodeURIComponent(request.url.replace('local-audio://', ''))
    callback({ path: filePath })
  })

  createWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})

// Window controls
ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window-close', () => mainWindow?.close())

// Music scanning
const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.wma', '.aac', '.opus', '.wv', '.ape'])

function getDefaultMusicDirs() {
  const home = os.homedir()
  const dirs = [
    path.join(home, 'Music'),
    path.join(home, 'Downloads'),
    path.join(home, 'Desktop'),
  ]
  // Add all drive roots (D:\Music, E:\Music etc.)
  for (let c = 68; c <= 90; c++) { // D-Z
    const drive = String.fromCharCode(c) + ':\\'
    try {
      if (fs.existsSync(drive)) {
        const musicDir = path.join(drive, 'Music')
        if (fs.existsSync(musicDir)) dirs.push(musicDir)
      }
    } catch {}
  }
  return dirs.filter(d => { try { return fs.existsSync(d) } catch { return false } })
}

function walkDir(dir, files = [], depth = 0) {
  if (depth > 8) return files // prevent insanely deep recursion
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        // Skip hidden/system folders
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '$RECYCLE.BIN') continue
        walkDir(fullPath, files, depth + 1)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (AUDIO_EXTENSIONS.has(ext)) {
          files.push(fullPath)
        }
      }
    }
  } catch {}
  return files
}

ipcMain.handle('scan-library', async (event, customDirs) => {
  const dirs = customDirs && customDirs.length ? customDirs : getDefaultMusicDirs()
  const allFiles = []
  for (const dir of dirs) {
    walkDir(dir, allFiles)
  }

  // Read metadata
  let mm
  try {
    mm = await import('music-metadata')
  } catch (e) {
    console.error('music-metadata import failed:', e)
    // Fallback: return files with just filename info
    return allFiles.map((f, i) => ({
      id: String(i + 1),
      title: path.basename(f, path.extname(f)),
      artist: 'Unknown Artist',
      album: 'Unknown Album',
      genre: 'Unknown',
      duration: 0,
      path: f,
    }))
  }

  const songs = []
  let id = 1
  for (const filePath of allFiles) {
    try {
      const metadata = await mm.parseFile(filePath, { duration: true, skipCovers: true })
      const { common, format } = metadata
      songs.push({
        id: String(id++),
        title: common.title || path.basename(filePath, path.extname(filePath)),
        artist: common.artist || 'Unknown Artist',
        album: common.album || 'Unknown Album',
        genre: (common.genre && common.genre[0]) || 'Unknown',
        duration: Math.round((format.duration || 0) * 1000), // ms
        path: filePath,
      })
    } catch {
      // Can't read metadata, use filename
      songs.push({
        id: String(id++),
        title: path.basename(filePath, path.extname(filePath)),
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        genre: 'Unknown',
        duration: 0,
        path: filePath,
      })
    }

    // Send progress updates every 50 files
    if (songs.length % 50 === 0) {
      mainWindow?.webContents.send('scan-progress', { found: songs.length, total: allFiles.length })
    }
  }

  return songs
})

ipcMain.handle('pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

ipcMain.handle('get-file-url', (event, filePath) => {
  return 'local-audio://' + encodeURIComponent(filePath)
})
