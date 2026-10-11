import { ref, watch } from 'vue'
import { usePlayer } from './usePlayer.js'

const localIP = ref('')
const syncPorts = ref({ ws: 9525, http: 9526 })
const connectedDevices = ref(0)
const activeDevice = ref('pc') // 'pc' or 'phone'
const phoneIsPlaying = ref(false)

let initialized = false
let stateInterval = null

export function useSync() {
  const {
    currentTrack, currentIndex, isPlaying, progress, duration,
    queue, volume, shuffled, repeatMode,
    play, pause, togglePlayPause, next, prev, seek, setVolume,
    playAll, playTrackFromList, toggleShuffle, toggleRepeat,
    library, playNext,
  } = usePlayer()

  const api = window.electronAPI

  function sendState() {
    if (!api) return
    const track = currentTrack.value
    const playing = activeDevice.value === 'phone' ? phoneIsPlaying.value : isPlaying.value
    // Include next 20 tracks in queue for mobile "Up Next"
    const upNext = currentIndex.value >= 0
      ? queue.value.slice(currentIndex.value + 1, currentIndex.value + 21).map(s => ({
          id: s.id, title: s.title, artist: s.artist, album: s.album, duration: s.duration,
        }))
      : []
    api.sendSyncState({
      currentTrack: track ? { id: track.id, title: track.title, artist: track.artist, album: track.album, duration: track.duration } : null,
      currentIndex: currentIndex.value,
      isPlaying: playing,
      progress: progress.value,
      duration: duration.value,
      volume: volume.value,
      shuffled: shuffled.value,
      repeatMode: repeatMode.value,
      activeDevice: activeDevice.value,
      queueLength: queue.value.length,
      upNext,
    })
  }

  function handleCommand(msg) {
    const { action, data } = msg
    const onPhone = activeDevice.value === 'phone'

    switch (action) {
      case 'play':
        if (onPhone) { phoneIsPlaying.value = true; sendState() }
        else play()
        break
      case 'pause':
        if (onPhone) { phoneIsPlaying.value = false; sendState() }
        else pause()
        break
      case 'toggle':
        if (onPhone) { phoneIsPlaying.value = !phoneIsPlaying.value; sendState() }
        else togglePlayPause()
        break
      case 'next':
        next()
        if (onPhone) { pause(); phoneIsPlaying.value = true; sendState() }
        break
      case 'prev':
        prev()
        if (onPhone) { pause(); phoneIsPlaying.value = true; sendState() }
        break
      case 'seek':
        seek(data.time)
        break
      case 'setVolume':
        setVolume(data.volume)
        break
      case 'toggleShuffle':
        toggleShuffle()
        break
      case 'toggleRepeat':
        toggleRepeat()
        break
      case 'playTrack': {
        const track = library.value.find(s => s.id === data.songId)
        if (track) {
          playTrackFromList(library.value, track)
          if (onPhone) { pause(); phoneIsPlaying.value = true; sendState() }
        }
        break
      }
      case 'playAll': {
        playAll(library.value, data.startIndex || 0)
        if (onPhone) { pause(); phoneIsPlaying.value = true; sendState() }
        break
      }
      case 'playNext': {
        const track = library.value.find(s => s.id === data.songId)
        if (track) playNext([track])
        sendState()
        break
      }
      case 'addToQueue': {
        const track = library.value.find(s => s.id === data.songId)
        if (track) {
          queue.value.push(track)
        }
        sendState()
        break
      }
      case 'transfer': {
        activeDevice.value = data.device
        if (data.device === 'phone') {
          phoneIsPlaying.value = isPlaying.value
          pause()
        } else {
          // Phone → PC: seek to where the phone was
          if (typeof data.time === 'number') seek(data.time)
          if (phoneIsPlaying.value) play()
          phoneIsPlaying.value = false
        }
        sendState()
        break
      }
      // Playlist commands
      case 'getPlaylists': {
        api.loadPlaylists().then(pls => {
          api.sendSyncState({ type: 'playlists', data: pls || [] })
        })
        break
      }
      case 'createPlaylist': {
        api.loadPlaylists().then(pls => {
          pls = pls || []
          pls.push({ id: Date.now().toString(), name: data.name, songIds: [] })
          api.savePlaylists(pls)
          api.sendSyncState({ type: 'playlists', data: pls })
        })
        break
      }
      case 'deletePlaylist': {
        api.loadPlaylists().then(pls => {
          pls = (pls || []).filter(p => p.id !== data.playlistId)
          api.savePlaylists(pls)
          api.sendSyncState({ type: 'playlists', data: pls })
        })
        break
      }
      case 'addToPlaylist': {
        api.loadPlaylists().then(pls => {
          pls = pls || []
          const pl = pls.find(p => p.id === data.playlistId)
          if (pl && !pl.songIds.includes(data.songId)) {
            pl.songIds.push(data.songId)
            api.savePlaylists(pls)
          }
          api.sendSyncState({ type: 'playlists', data: pls })
        })
        break
      }
    }
  }

  function init() {
    if (initialized || !api) return
    initialized = true

    api.getLocalIP().then(ip => { localIP.value = ip })
    api.getSyncPorts().then(ports => { syncPorts.value = ports })

    // Send library to main process for mobile clients
    watch(() => library.value.length, () => {
      if (library.value.length > 0) {
        const plain = library.value.map(s => ({
          id: s.id, title: s.title, artist: s.artist,
          album: s.album, genre: s.genre, duration: s.duration,
          path: s.path,
        }))
        api.sendSyncLibrary(plain)
      }
    }, { immediate: true })

    // Listen for commands from mobile
    api.onSyncCommand((msg) => {
      if (msg.type === 'command') handleCommand(msg)
    })

    // Send state updates on changes
    watch([isPlaying, () => currentTrack.value?.id, volume, shuffled, repeatMode], () => {
      sendState()
    })

    // Send state frequently for smooth progress sync
    stateInterval = setInterval(() => {
      sendState()
    }, 500)

    // Poll connected device count
    setInterval(() => {
      api.getConnectedDevices().then(n => { connectedDevices.value = n })
    }, 3000)
  }

  return {
    localIP, syncPorts, connectedDevices, activeDevice,
    init, sendState,
  }
}
