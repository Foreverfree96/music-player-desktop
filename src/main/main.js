const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

let mainWindow

// Persistent data directory
const dataDir = path.join(os.homedir(), '.music-player')
const cacheFile = path.join(dataDir, 'library-cache.json')
const playlistsFile = path.join(dataDir, 'playlists.json')
const settingsFile = path.join(dataDir, 'settings.json')

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
}

function readJSON(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {}
  return fallback
}

function writeJSON(filePath, data) {
  ensureDataDir()
  fs.writeFileSync(filePath, JSON.stringify(data), 'utf8')
}

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

app.whenReady().then(() => {
  protocol.registerFileProtocol('local-audio', (request, callback) => {
    const filePath = decodeURIComponent(request.url.replace('local-audio://', ''))
    callback({ path: filePath })
  })
  ensureDataDir()
  createWindow()
})

app.on('window-all-closed', () => app.quit())

// Window controls
ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window-close', () => mainWindow?.close())

// ─── Music scanning ───

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.wma', '.aac', '.opus', '.wv', '.ape'])

function getDefaultMusicDirs() {
  const home = os.homedir()
  const dirs = [
    path.join(home, 'Music'),
    path.join(home, 'Downloads'),
    path.join(home, 'Desktop'),
  ]
  for (let c = 68; c <= 90; c++) {
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
  if (depth > 8) return files
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '$RECYCLE.BIN') continue
        walkDir(fullPath, files, depth + 1)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (AUDIO_EXTENSIONS.has(ext)) files.push(fullPath)
      }
    }
  } catch {}
  return files
}

const GENRE_MAP = {
  'rock': 'Rock', 'alternative': 'Rock', 'alternative rock': 'Rock', 'indie rock': 'Rock',
  'indie': 'Rock', 'hard rock': 'Rock', 'classic rock': 'Rock', 'soft rock': 'Rock',
  'punk': 'Rock', 'punk rock': 'Rock', 'post-punk': 'Rock', 'grunge': 'Rock',
  'progressive rock': 'Rock', 'prog rock': 'Rock', 'psychedelic rock': 'Rock',
  'garage rock': 'Rock', 'art rock': 'Rock', 'blues rock': 'Rock',
  'folk rock': 'Rock', 'southern rock': 'Rock', 'surf rock': 'Rock',
  'stoner rock': 'Rock', 'math rock': 'Rock', 'post-rock': 'Rock',
  'emo': 'Rock', 'screamo': 'Rock', 'new wave': 'Rock', 'britpop': 'Rock',
  'shoegaze': 'Rock', 'noise rock': 'Rock', 'experimental rock': 'Rock',
  'pop': 'Pop', 'synth-pop': 'Pop', 'synthpop': 'Pop', 'electropop': 'Pop',
  'dance pop': 'Pop', 'indie pop': 'Pop', 'art pop': 'Pop', 'dream pop': 'Pop',
  'k-pop': 'Pop', 'j-pop': 'Pop', 'teen pop': 'Pop', 'bubblegum pop': 'Pop',
  'power pop': 'Pop', 'chamber pop': 'Pop', 'baroque pop': 'Pop',
  'sunshine pop': 'Pop', 'europop': 'Pop', 'latin pop': 'Pop',
  'hip-hop': 'Hip-Hop', 'hip hop': 'Hip-Hop', 'rap': 'Hip-Hop', 'trap': 'Hip-Hop',
  'gangsta rap': 'Hip-Hop', 'conscious rap': 'Hip-Hop', 'east coast hip hop': 'Hip-Hop',
  'west coast hip hop': 'Hip-Hop', 'southern hip hop': 'Hip-Hop', 'drill': 'Hip-Hop',
  'boom bap': 'Hip-Hop', 'lo-fi hip hop': 'Hip-Hop', 'cloud rap': 'Hip-Hop',
  'mumble rap': 'Hip-Hop', 'old school hip hop': 'Hip-Hop', 'underground hip hop': 'Hip-Hop',
  'trip hop': 'Hip-Hop', 'grime': 'Hip-Hop', 'crunk': 'Hip-Hop',
  'electronic': 'Electronic', 'edm': 'Electronic', 'house': 'Electronic',
  'deep house': 'Electronic', 'tech house': 'Electronic', 'progressive house': 'Electronic',
  'techno': 'Electronic', 'trance': 'Electronic', 'dubstep': 'Electronic',
  'drum and bass': 'Electronic', 'dnb': 'Electronic', 'ambient': 'Electronic',
  'chillwave': 'Electronic', 'downtempo': 'Electronic', 'idm': 'Electronic',
  'electro': 'Electronic', 'electronica': 'Electronic', 'dance': 'Electronic',
  'disco': 'Electronic', 'nu-disco': 'Electronic', 'future bass': 'Electronic',
  'hardstyle': 'Electronic', 'garage': 'Electronic', 'uk garage': 'Electronic',
  'breakbeat': 'Electronic', 'industrial': 'Electronic', 'synthwave': 'Electronic',
  'vaporwave': 'Electronic', 'eurodance': 'Electronic', 'big room': 'Electronic',
  'tropical house': 'Electronic', 'lo-fi': 'Electronic', 'lofi': 'Electronic',
  'r&b': 'R&B', 'rnb': 'R&B', 'soul': 'R&B', 'neo-soul': 'R&B', 'neo soul': 'R&B',
  'rhythm and blues': 'R&B', 'contemporary r&b': 'R&B', 'funk': 'R&B',
  'motown': 'R&B', 'quiet storm': 'R&B', 'new jack swing': 'R&B',
  'country': 'Country', 'country rock': 'Country', 'country pop': 'Country',
  'alt-country': 'Country', 'americana': 'Country', 'bluegrass': 'Country',
  'outlaw country': 'Country', 'honky tonk': 'Country', 'country folk': 'Country',
  'bro-country': 'Country', 'nashville sound': 'Country',
  'jazz': 'Jazz', 'smooth jazz': 'Jazz', 'jazz fusion': 'Jazz', 'bebop': 'Jazz',
  'cool jazz': 'Jazz', 'free jazz': 'Jazz', 'swing': 'Jazz', 'big band': 'Jazz',
  'acid jazz': 'Jazz', 'latin jazz': 'Jazz', 'modal jazz': 'Jazz',
  'nu jazz': 'Jazz', 'vocal jazz': 'Jazz', 'jazz rap': 'Jazz',
  'metal': 'Metal', 'heavy metal': 'Metal', 'death metal': 'Metal',
  'black metal': 'Metal', 'thrash metal': 'Metal', 'power metal': 'Metal',
  'doom metal': 'Metal', 'progressive metal': 'Metal', 'metalcore': 'Metal',
  'deathcore': 'Metal', 'nu metal': 'Metal', 'nu-metal': 'Metal',
  'symphonic metal': 'Metal', 'folk metal': 'Metal', 'speed metal': 'Metal',
  'groove metal': 'Metal', 'sludge metal': 'Metal', 'post-metal': 'Metal',
  'djent': 'Metal', 'gothic metal': 'Metal', 'industrial metal': 'Metal',
  'classical': 'Classical', 'opera': 'Classical', 'orchestral': 'Classical',
  'chamber music': 'Classical', 'baroque': 'Classical', 'romantic': 'Classical',
  'contemporary classical': 'Classical', 'minimalism': 'Classical',
  'neoclassical': 'Classical', 'choral': 'Classical', 'symphony': 'Classical',
  'latin': 'Latin', 'reggaeton': 'Latin', 'salsa': 'Latin', 'bachata': 'Latin',
  'cumbia': 'Latin', 'merengue': 'Latin', 'bossa nova': 'Latin',
  'samba': 'Latin', 'tango': 'Latin', 'mariachi': 'Latin', 'corrido': 'Latin',
  'dembow': 'Latin', 'urbano': 'Latin',
  'reggae': 'Reggae', 'dancehall': 'Reggae', 'dub': 'Reggae', 'ska': 'Reggae',
  'roots reggae': 'Reggae', 'lovers rock': 'Reggae', 'ragga': 'Reggae',
  'folk': 'Folk', 'acoustic': 'Folk', 'singer-songwriter': 'Folk',
  'singer/songwriter': 'Folk', 'indie folk': 'Folk', 'contemporary folk': 'Folk',
  'traditional folk': 'Folk', 'celtic': 'Folk', 'world': 'Folk',
  'world music': 'Folk', 'afrobeat': 'Folk', 'afropop': 'Folk',
  'blues': 'Blues', 'delta blues': 'Blues', 'electric blues': 'Blues',
  'chicago blues': 'Blues', 'country blues': 'Blues', 'rhythm & blues': 'Blues',
  'gospel': 'Gospel', 'christian': 'Gospel', 'ccm': 'Gospel',
  'worship': 'Gospel', 'christian rock': 'Gospel', 'christian hip hop': 'Gospel',
  'praise': 'Gospel', 'hymn': 'Gospel', 'spiritual': 'Gospel',
  'soundtrack': 'Soundtrack', 'ost': 'Soundtrack', 'film score': 'Soundtrack',
  'score': 'Soundtrack', 'movie soundtrack': 'Soundtrack', 'video game': 'Soundtrack',
  'game': 'Soundtrack', 'anime': 'Soundtrack',
}

function normalizeGenre(raw) {
  if (!raw || raw === 'Unknown') return 'Other'
  const lower = raw.toLowerCase().trim()
  if (GENRE_MAP[lower]) return GENRE_MAP[lower]
  for (const [key, main] of Object.entries(GENRE_MAP)) {
    if (lower.includes(key)) return main
  }
  return 'Other'
}

const junkPatterns = [
  /\bringtone/i, /\bnotification/i, /\balarm/i, /\balert/i,
  /\bsystem\s?sound/i, /\bui[\s_-]?sound/i, /\bbeep/i, /\bboop/i,
  /\bclick/i, /\bpop/i, /\bding/i, /\btone\d/i,
  /\btest[\s_-]?file/i, /\bsample[\s_-]?audio/i,
  /\bvoice[\s_-]?memo/i, /\brecording[\s_-]?\d/i,
  /\baudio[\s_-]?recording/i, /\bvoice[\s_-]?\d/i,
]
const junkPaths = [
  /\\windows\\/i, /\\system32\\/i, /\\program\s?files/i,
  /\\appdata\\/i, /\\programdata\\/i,
  /\\cache\b/i, /\\temp\b/i, /\\tmp\b/i,
  /\\node_modules\\/i, /\\\.git\\/i,
  /\\ringtones?\\/i, /\\notifications?\\/i, /\\alarms?\\/i,
]
const MIN_DURATION_MS = 30000

function filterAndDedup(songs) {
  const filtered = songs.filter(s => {
    if (s.duration > 0 && s.duration < MIN_DURATION_MS) return false
    if (junkPatterns.some(p => p.test(s.title))) return false
    if (junkPaths.some(p => p.test(s.path))) return false
    return true
  })
  const seen = new Map()
  for (const s of filtered) {
    const key = s.title.toLowerCase().trim() + '|||' + s.artist.toLowerCase().trim()
    const existing = seen.get(key)
    if (!existing || s.duration > existing.duration) seen.set(key, s)
  }
  const deduped = [...seen.values()]
  deduped.forEach((s, i) => { s.id = String(i + 1) })
  return deduped
}

// Load cached library — returns null if no cache
ipcMain.handle('load-cached-library', () => {
  return readJSON(cacheFile, null)
})

// Full rescan
ipcMain.handle('scan-library', async (event, customDirs) => {
  const dirs = customDirs && customDirs.length ? customDirs : getDefaultMusicDirs()
  const allFiles = []
  for (const dir of dirs) walkDir(dir, allFiles)

  let mm
  try {
    mm = await import('music-metadata')
  } catch (e) {
    console.error('music-metadata import failed:', e)
    const songs = allFiles.map((f, i) => ({
      id: String(i + 1),
      title: path.basename(f, path.extname(f)),
      artist: 'Unknown Artist', album: 'Unknown Album', genre: 'Other',
      duration: 0, path: f,
    }))
    const result = filterAndDedup(songs)
    writeJSON(cacheFile, result)
    return result
  }

  const songs = []
  let id = 1
  for (const filePath of allFiles) {
    try {
      const metadata = await mm.parseFile(filePath, { duration: true, skipCovers: true })
      const { common, format } = metadata
      const rawGenre = (common.genre && common.genre[0]) || 'Unknown'
      songs.push({
        id: String(id++),
        title: common.title || path.basename(filePath, path.extname(filePath)),
        artist: common.artist || 'Unknown Artist',
        album: common.album || 'Unknown Album',
        genre: normalizeGenre(rawGenre),
        duration: Math.round((format.duration || 0) * 1000),
        path: filePath,
      })
    } catch {
      songs.push({
        id: String(id++),
        title: path.basename(filePath, path.extname(filePath)),
        artist: 'Unknown Artist', album: 'Unknown Album', genre: 'Other',
        duration: 0, path: filePath,
      })
    }
    if (songs.length % 50 === 0) {
      mainWindow?.webContents.send('scan-progress', { found: songs.length, total: allFiles.length })
    }
  }

  const result = filterAndDedup(songs)
  writeJSON(cacheFile, result)
  return result
})

ipcMain.handle('pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
  if (result.canceled) return null
  return result.filePaths[0]
})

ipcMain.handle('get-file-url', (event, filePath) => {
  return 'local-audio://' + encodeURIComponent(filePath)
})

// ─── Playlists ───

ipcMain.handle('load-playlists', () => {
  return readJSON(playlistsFile, [])
})

ipcMain.handle('save-playlists', (event, playlists) => {
  writeJSON(playlistsFile, playlists)
  return true
})

// ─── Settings (saved folders) ───

ipcMain.handle('load-settings', () => {
  return readJSON(settingsFile, {})
})

ipcMain.handle('save-settings', (event, settings) => {
  writeJSON(settingsFile, settings)
  return true
})
