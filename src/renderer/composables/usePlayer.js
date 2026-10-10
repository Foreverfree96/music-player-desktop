import { ref, computed } from 'vue'

const audio = new Audio()
audio.crossOrigin = 'anonymous'
const library = ref([])
const queue = ref([])
const originalQueue = ref([])
const currentIndex = ref(-1)
const isPlaying = ref(false)
const progress = ref(0)
const duration = ref(0)
const shuffled = ref(false)
const repeatMode = ref('off')
const savedVol = parseInt(localStorage.getItem('mp-volume') ?? '80')
const volume = ref(Math.max(0, Math.min(100, savedVol)))
audio.volume = Math.pow(volume.value / 100, 2)
const loading = ref(false)
const scanStatus = ref('')

// ─── Web Audio API — Equalizer ───

const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

const EQ_PRESETS = {
  'Flat':         [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Bass Boost':   [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  'Treble Boost': [0, 0, 0, 0, 0, 1, 2, 4, 5, 6],
  'Rock':         [5, 4, 2, 0, -1, 0, 2, 3, 4, 4],
  'Pop':          [-1, 1, 3, 4, 3, 0, -1, -1, 1, 2],
  'Jazz':         [3, 2, 0, 1, -1, -1, 0, 1, 3, 4],
  'Classical':    [4, 3, 2, 1, -1, -1, 0, 2, 3, 4],
  'Electronic':   [5, 4, 2, 0, -2, 0, 1, 3, 4, 5],
  'Vocal':        [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1],
  'Bass Cut':     [-6, -4, -2, 0, 0, 0, 0, 0, 0, 0],
}

// Load saved EQ state
const savedBands = JSON.parse(localStorage.getItem('mp-eq-bands') || 'null')
const savedPreset = localStorage.getItem('mp-eq-preset') || 'Flat'
const savedEnabled = localStorage.getItem('mp-eq-enabled') !== 'false'

const eqBands = ref(
  savedBands || EQ_FREQUENCIES.map((freq, i) => ({
    freq,
    gain: (EQ_PRESETS[savedPreset] || EQ_PRESETS.Flat)[i]
  }))
)
const eqPreset = ref(savedPreset)
const eqEnabled = ref(savedEnabled)

// Web Audio nodes (initialized lazily on first play)
let audioContext = null
let sourceNode = null
let gainNode = null
let filterNodes = []
let audioContextInitialized = false

function initAudioContext() {
  if (audioContextInitialized) return
  audioContextInitialized = true

  audioContext = new (window.AudioContext || window.webkitAudioContext)()
  sourceNode = audioContext.createMediaElementSource(audio)
  gainNode = audioContext.createGain()

  // Set initial volume on gain node
  gainNode.gain.value = Math.pow(volume.value / 100, 2)

  // Create 10 biquad filters
  filterNodes = EQ_FREQUENCIES.map((freq, i) => {
    const filter = audioContext.createBiquadFilter()
    filter.type = i === 0 ? 'lowshelf' : i === 9 ? 'highshelf' : 'peaking'
    filter.frequency.value = freq
    if (filter.type === 'peaking') filter.Q.value = 1.4
    filter.gain.value = eqEnabled.value ? eqBands.value[i].gain : 0
    return filter
  })

  // Connect chain: source → filters → gain → destination
  let prev = sourceNode
  for (const filter of filterNodes) {
    prev.connect(filter)
    prev = filter
  }
  prev.connect(gainNode)
  gainNode.connect(audioContext.destination)

  // Since we're now using gainNode for volume, set audio.volume to 1
  audio.volume = 1
}

function saveEqState() {
  localStorage.setItem('mp-eq-bands', JSON.stringify(eqBands.value))
  localStorage.setItem('mp-eq-preset', eqPreset.value)
  localStorage.setItem('mp-eq-enabled', String(eqEnabled.value))
}

function setEqBand(index, gain) {
  eqBands.value[index].gain = gain
  if (filterNodes[index] && eqEnabled.value) {
    filterNodes[index].gain.value = gain
  }
  eqPreset.value = 'Custom'
  saveEqState()
}

function setEqPreset(name) {
  const gains = EQ_PRESETS[name]
  if (!gains) return
  eqPreset.value = name
  for (let i = 0; i < 10; i++) {
    eqBands.value[i].gain = gains[i]
    if (filterNodes[i]) {
      filterNodes[i].gain.value = eqEnabled.value ? gains[i] : 0
    }
  }
  saveEqState()
}

function toggleEq() {
  eqEnabled.value = !eqEnabled.value
  for (let i = 0; i < filterNodes.length; i++) {
    filterNodes[i].gain.value = eqEnabled.value ? eqBands.value[i].gain : 0
  }
  saveEqState()
}

// ─── Core player ───

const currentTrack = computed(() => {
  if (currentIndex.value < 0 || currentIndex.value >= queue.value.length) return null
  return queue.value[currentIndex.value]
})

audio.addEventListener('timeupdate', () => {
  progress.value = audio.currentTime
  duration.value = audio.duration || 0
  // Save playback position every few seconds
  const track = currentTrack.value
  if (track && Math.floor(audio.currentTime) % 3 === 0) {
    localStorage.setItem('mp-last-track', track.path)
    localStorage.setItem('mp-last-time', String(audio.currentTime))
  }
})

audio.addEventListener('ended', () => {
  if (repeatMode.value === 'one') {
    audio.currentTime = 0
    audio.play()
  } else if (currentIndex.value < queue.value.length - 1) {
    next()
  } else if (repeatMode.value === 'all') {
    currentIndex.value = 0
    playCurrentTrack()
  } else {
    isPlaying.value = false
  }
})

audio.addEventListener('play', () => { isPlaying.value = true })
audio.addEventListener('pause', () => { isPlaying.value = false })

function playCurrentTrack() {
  const track = currentTrack.value
  if (!track) return

  // Initialize Web Audio chain on first play
  initAudioContext()
  if (audioContext?.state === 'suspended') audioContext.resume()

  const url = 'file:///' + track.path.replace(/\\/g, '/')
  audio.src = url
  audio.play().catch(e => console.error('Play error:', e))
}

function playAll(tracks, startIdx = 0) {
  queue.value = [...tracks]
  originalQueue.value = [...tracks]
  currentIndex.value = startIdx
  if (shuffled.value) {
    shuffleQueue(true)
  }
  playCurrentTrack()
}

function playTrackFromList(tracks, track) {
  const idx = tracks.findIndex(t => t.id === track.id)
  playAll(tracks, idx >= 0 ? idx : 0)
}

function play() {
  if (audioContext?.state === 'suspended') audioContext.resume()
  if (audio.src) audio.play().catch(() => {})
}

function pause() {
  audio.pause()
}

function togglePlayPause() {
  if (isPlaying.value) pause()
  else play()
}

function next() {
  if (queue.value.length === 0) return
  if (currentIndex.value < queue.value.length - 1) {
    currentIndex.value++
  } else if (repeatMode.value === 'all') {
    currentIndex.value = 0
  } else {
    return
  }
  playCurrentTrack()
}

function prev() {
  if (audio.currentTime > 3) {
    audio.currentTime = 0
    return
  }
  if (currentIndex.value > 0) {
    currentIndex.value--
  } else if (repeatMode.value === 'all') {
    currentIndex.value = queue.value.length - 1
  }
  playCurrentTrack()
}

function seek(time) {
  audio.currentTime = time
}

function setVolume(v) {
  volume.value = v
  const scaled = Math.pow(v / 100, 2)
  if (gainNode) {
    gainNode.gain.value = scaled
  } else {
    audio.volume = scaled
  }
  localStorage.setItem('mp-volume', String(Math.round(v)))
}

function shuffleQueue(keepCurrent = true) {
  if (queue.value.length <= 1) return
  const current = currentTrack.value
  const rest = queue.value.filter((_, i) => i !== currentIndex.value)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]]
  }
  if (keepCurrent && current) {
    queue.value = [current, ...rest]
    currentIndex.value = 0
  } else {
    queue.value = rest
    currentIndex.value = 0
  }
}

function toggleShuffle() {
  shuffled.value = !shuffled.value
  if (shuffled.value) {
    shuffleQueue(true)
  } else {
    const current = currentTrack.value
    queue.value = [...originalQueue.value]
    if (current) {
      currentIndex.value = queue.value.findIndex(t => t.id === current.id)
      if (currentIndex.value < 0) currentIndex.value = 0
    }
  }
}

function toggleRepeat() {
  const modes = ['off', 'one', 'all']
  const idx = modes.indexOf(repeatMode.value)
  repeatMode.value = modes[(idx + 1) % 3]
}

function playNext(tracks) {
  if (!tracks.length) return
  // If nothing is playing, just start playing these tracks
  if (currentIndex.value < 0 || queue.value.length === 0) {
    playAll(tracks, 0)
    return
  }
  const insertAt = currentIndex.value + 1
  // Remove these tracks from upcoming queue positions (after current) to avoid duplicates
  const trackIds = new Set(tracks.map(t => t.id))
  const before = queue.value.slice(0, insertAt)
  const after = queue.value.slice(insertAt).filter(t => !trackIds.has(t.id))
  queue.value = [...before, ...tracks, ...after]
}

function restoreLastTrack() {
  const lastPath = localStorage.getItem('mp-last-track')
  const lastTime = parseFloat(localStorage.getItem('mp-last-time') || '0')
  if (!lastPath) return
  const track = library.value.find(s => s.path === lastPath)
  if (!track) return
  queue.value = [track]
  originalQueue.value = [track]
  currentIndex.value = 0
  initAudioContext()
  if (audioContext?.state === 'suspended') audioContext.resume()
  const url = 'file:///' + track.path.replace(/\\/g, '/')
  audio.src = url
  audio.currentTime = lastTime
  // Don't auto-play, just load it paused
}

function formatTime(secs) {
  if (!secs || isNaN(secs)) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function usePlayer() {
  return {
    library, queue, currentTrack, currentIndex, isPlaying, progress, duration,
    shuffled, repeatMode, volume, loading, scanStatus,
    playAll, playTrackFromList, play, pause, togglePlayPause,
    next, prev, seek, setVolume, toggleShuffle, toggleRepeat, formatTime, restoreLastTrack, playNext,
    // EQ
    eqBands, eqPreset, eqEnabled, EQ_PRESETS, EQ_FREQUENCIES,
    setEqBand, setEqPreset, toggleEq,
  }
}
