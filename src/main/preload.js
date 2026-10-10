const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  loadCachedLibrary: () => ipcRenderer.invoke('load-cached-library'),
  scanLibrary: (dirs) => ipcRenderer.invoke('scan-library', dirs),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  getFileUrl: (path) => ipcRenderer.invoke('get-file-url', path),
  onScanProgress: (cb) => ipcRenderer.on('scan-progress', (_, data) => cb(data)),
  loadPlaylists: () => ipcRenderer.invoke('load-playlists'),
  savePlaylists: (playlists) => ipcRenderer.invoke('save-playlists', playlists),
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
})
