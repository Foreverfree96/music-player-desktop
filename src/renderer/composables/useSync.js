import { ref, watch } from 'vue'
import { usePlayer } from './usePlayer.js'

const localIP = ref('')
const syncPorts = ref({ ws: 9525, http: 9526 })
const connectedDevices = ref(0)
const activeDevice = ref('pc') // 'pc' or 'phone'

let initialized = false
let stateInterval = null

export function useSync() {
  const {
    currentTrack, currentIndex, isPlaying, progress, duration,
    queue, volume, shuffled, repeatMode,
    play, pause, togglePlayPause, next, prev, seek, setVolume,
    playAll, playTrackFromList, toggleShuffle, toggleRepeat,
    library,
  } = usePlayer()

  const api = window.electronAPI

  function sendState() {
    if (!api) return
    const track = currentTrack.value
    api.sendSyncState({
      currentTrack: track ? { id: track.id, title: track.title, artist: track.artist, album: track.album, duration: track.duration } : null,
      currentIndex: currentIndex.value,
      isPlaying: isPlaying.value,
      progress: progress.value,
      duration: duration.value,
      volume: volume.value,
      shuffled: shuffled.value,
      repeatMode: repeatMode.value,
      activeDevice: activeDevice.value,
      queueLength: queue.value.length,
    })
  }

  function handleCommand(msg) {
    const { action, data } = msg
    switch (action) {
      case 'play': play(); break
      case 'pause': pause(); break
      case 'toggle': togglePlayPause(); break
      case 'next': next(); break
      case 'prev': prev(); break
      case 'seek': seek(data.time); break
      case 'setVolume': setVolume(data.volume); break
      case 'toggleShuffle': toggleShuffle(); break
      case 'toggleRepeat': toggleRepeat(); break
      case 'playTrack': {
        const track = library.value.find(s => s.id === data.songId)
        if (track) playTrackFromList(library.value, track)
        break
      }
      case 'playAll': {
        playAll(library.value, data.startIndex || 0)
        break
      }
      case 'transfer': {
        activeDevice.value = data.device
        if (data.device === 'phone') {
          // Pause PC playback — phone will start playing
          pause()
        }
        sendState()
        break
      }
    }
  }

  function init() {
    if (initialized || !api) return
    initialized = true

    // Get local IP
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

    // Send state updates periodically and on changes
    watch([isPlaying, () => currentTrack.value?.id, volume, shuffled, repeatMode], () => {
      sendState()
    })

    // Poll connected device count
    stateInterval = setInterval(() => {
      sendState()
      api.getConnectedDevices().then(n => { connectedDevices.value = n })
    }, 2000)
  }

  return {
    localIP, syncPorts, connectedDevices, activeDevice,
    init, sendState,
  }
}
