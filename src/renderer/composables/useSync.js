import { ref, watch } from 'vue'
import { usePlayer } from './usePlayer.js'

const localIP = ref('')
const syncPorts = ref({ ws: 9525, http: 9526 })
const connectedDevices = ref(0)
const activeDevice = ref('pc') // 'pc' or 'phone'
const phoneIsPlaying = ref(false) // track play state independently for phone mode

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
    const playing = activeDevice.value === 'phone' ? phoneIsPlaying.value : isPlaying.value
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
        next() // updates queue/track on desktop
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
      case 'transfer': {
        activeDevice.value = data.device
        if (data.device === 'phone') {
          phoneIsPlaying.value = isPlaying.value // carry over current play state
          pause() // stop local playback
        } else {
          // Switching back to PC
          if (phoneIsPlaying.value) play() // resume local playback
          phoneIsPlaying.value = false
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

    // Send state frequently for smooth progress sync
    stateInterval = setInterval(() => {
      sendState()
    }, 500)

    // Poll connected device count less often
    setInterval(() => {
      api.getConnectedDevices().then(n => { connectedDevices.value = n })
    }, 3000)
  }

  return {
    localIP, syncPorts, connectedDevices, activeDevice,
    init, sendState,
  }
}
