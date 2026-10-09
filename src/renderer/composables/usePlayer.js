import { ref, computed } from 'vue'

const audio = new Audio()
const library = ref([])
const queue = ref([])
const originalQueue = ref([])
const currentIndex = ref(-1)
const isPlaying = ref(false)
const progress = ref(0)
const duration = ref(0)
const shuffled = ref(false)
const repeatMode = ref('off')
const volume = ref(1)
const loading = ref(false)
const scanStatus = ref('')

const currentTrack = computed(() => {
  if (currentIndex.value < 0 || currentIndex.value >= queue.value.length) return null
  return queue.value[currentIndex.value]
})

audio.addEventListener('timeupdate', () => {
  progress.value = audio.currentTime
  duration.value = audio.duration || 0
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
  // Use file:// protocol for local files on desktop
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
  audio.volume = v
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
    next, prev, seek, setVolume, toggleShuffle, toggleRepeat, formatTime,
  }
}
