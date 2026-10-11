const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  loadCachedLibrary: () => ipcRenderer.invoke('load-cached-library'),
  scanLibrary: (dirs) => ipcRenderer.invoke('scan-library', dirs),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  getFileUrl: (path) => ipcRenderer.invoke('get-file-url', path),
  onScanProgress: (cb) => ipcRenderer.on('scan-progress', (_, data) => cb(data)),
  loadPlaylists: () => ipcRenderer.invoke('load-playlists'),
  savePlaylists: (playlists) => ipcRenderer.invoke('save-playlists', playlists),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  onMediaKey: (cb) => ipcRenderer.on('media-key', (_, action) => cb(action)),
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  // Sync
  getLocalIP: () => ipcRenderer.invoke('get-local-ip'),
  getSyncPorts: () => ipcRenderer.invoke('get-sync-ports'),
  getConnectedDevices: () => ipcRenderer.invoke('get-connected-devices'),
  sendSyncState: (state) => ipcRenderer.send('sync-state', state),
  sendSyncLibrary: (library) => ipcRenderer.send('sync-library', library),
  onSyncCommand: (cb) => ipcRenderer.on('sync-command', (_, msg) => cb(msg)),
  onTrayPlaySong: (cb) => ipcRenderer.on('tray-play-song', (_, songId) => cb(songId)),
  // Identification
  identifyUnknownSongs: () => ipcRenderer.invoke('identify-unknown-songs'),
  cancelIdentify: () => ipcRenderer.send('identify-cancel'),
  onIdentifyProgress: (cb) => ipcRenderer.on('identify-progress', (_, data) => cb(data)),
})
