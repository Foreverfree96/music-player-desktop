<template>
  <div class="app">
    <!-- Custom Titlebar -->
    <div class="titlebar">
      <span class="titlebar-title">My Music Player</span>
      <div class="titlebar-controls">
        <button class="tb-btn" @click="minimize()">─</button>
        <button class="tb-btn" @click="maximize()">□</button>
        <button class="tb-btn tb-close" @click="closeWin()">×</button>
      </div>
    </div>

    <!-- Header -->
    <div class="header">
      <div v-if="detailView" class="header-back" @click="closeDetail()">
        <span class="back-arrow">←</span>
        <h1>{{ detailView.name }}</h1>
      </div>
      <template v-else>
        <h1>My Music</h1>
        <div class="header-right">
          <span class="song-count">{{ visibleLibrary.length }} songs</span>
          <button class="header-icon-btn" @click="rescanMusic()" title="Rescan library">↻</button>
          <button class="folder-btn" @click="addFolder()" title="Add music folder">+</button>
        </div>
      </template>
    </div>

    <!-- Tabs -->
    <div v-if="!detailView" class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >{{ tab.label }}</button>
    </div>

    <!-- Saved Folders -->
    <div v-if="!detailView && customDirs.length > 0" class="saved-folders">
      <div class="saved-folders-label">Folders:</div>
      <div class="saved-folder-chips">
        <div v-for="dir in customDirs" :key="dir" class="folder-chip">
          <span class="folder-chip-name" :title="dir">{{ folderName(dir) }}</span>
          <button class="folder-chip-remove" @click="removeFolder(dir)" title="Remove folder">×</button>
        </div>
      </div>
    </div>

    <!-- Search -->
    <div class="search-bar">
      <input
        v-model="search"
        type="text"
        :placeholder="searchPlaceholder"
        class="search-input"
      />
      <button v-if="search" class="clear-btn" @click="search = ''">×</button>
    </div>

    <!-- Content Area -->
    <div class="content-area">
      <div v-if="loading" class="loading">
        <div>Scanning for music...</div>
        <div v-if="scanStatus" class="scan-status">{{ scanStatus }}</div>
      </div>

      <!-- Detail View -->
      <template v-else-if="detailView">
        <div class="detail-header-info">
          <div class="detail-meta">{{ detailView.songs.length }} songs</div>
          <div class="detail-actions">
            <button class="action-btn" @click="playAllDetail()">▶ Play All</button>
            <button class="action-btn action-btn-outline" @click="shuffleDetail()">⇄ Shuffle</button>
          </div>
        </div>
        <div
          v-for="song in detailView.songs"
          :key="song.id"
          class="song-item"
          :class="{ active: currentTrack && currentTrack.id === song.id }"
          @click="playFromDetail(song)"
          @contextmenu.prevent="openSongMenu($event, song)"
        >
          <div class="song-info">
            <div class="song-title">{{ song.title }}</div>
            <div class="song-artist">{{ detailView.type === 'artist' ? song.album : song.artist }}</div>
          </div>
          <div class="song-duration">{{ formatDuration(song.duration) }}</div>
        </div>
      </template>

      <!-- Songs Tab -->
      <template v-else-if="activeTab === 'songs'">
        <div v-if="filteredSongs.length === 0" class="empty">
          {{ search ? 'No matches found' : 'No music found — click + to add a folder' }}
        </div>
        <div
          v-for="song in filteredSongs"
          :key="song.id"
          class="song-item"
          :class="{ active: currentTrack && currentTrack.id === song.id }"
          @click="playSong(song)"
          @contextmenu.prevent="openSongMenu($event, song)"
        >
          <div class="song-info">
            <div class="song-title">{{ song.title }}</div>
            <div class="song-artist">{{ song.artist }}</div>
          </div>
          <div class="song-duration">{{ formatDuration(song.duration) }}</div>
        </div>
      </template>

      <!-- Albums Tab -->
      <template v-else-if="activeTab === 'albums'">
        <div v-if="filteredAlbums.length === 0" class="empty">
          {{ search ? 'No matches found' : 'No albums found' }}
        </div>
        <div
          v-for="album in filteredAlbums"
          :key="album.name + album.artist"
          class="group-item"
          @click="openDetail('album', album.name, album.songs)"
        >
          <div class="group-icon album-icon">♫</div>
          <div class="group-info">
            <div class="group-name">{{ album.name }}</div>
            <div class="group-meta">{{ album.artist }} · {{ album.songs.length }} songs</div>
          </div>
          <div class="group-arrow">›</div>
        </div>
      </template>

      <!-- Artists Tab -->
      <template v-else-if="activeTab === 'artists'">
        <div v-if="filteredArtists.length === 0" class="empty">
          {{ search ? 'No matches found' : 'No artists found' }}
        </div>
        <div
          v-for="artist in filteredArtists"
          :key="artist.name"
          class="group-item"
          @click="openDetail('artist', artist.name, artist.songs)"
        >
          <div class="group-icon artist-icon">♪</div>
          <div class="group-info">
            <div class="group-name">{{ artist.name }}</div>
            <div class="group-meta">{{ artist.albumCount }} albums · {{ artist.songs.length }} songs</div>
          </div>
          <div class="group-arrow">›</div>
        </div>
      </template>

      <!-- Genres Tab -->
      <template v-else-if="activeTab === 'genres'">
        <div v-if="filteredGenres.length === 0" class="empty">
          {{ search ? 'No matches found' : 'No genres found' }}
        </div>
        <div
          v-for="genre in filteredGenres"
          :key="genre.name"
          class="group-item"
          @click="openDetail('genre', genre.name, genre.songs)"
        >
          <div class="group-icon genre-icon">♬</div>
          <div class="group-info">
            <div class="group-name">{{ genre.name }}</div>
            <div class="group-meta">{{ genre.artistCount }} artists · {{ genre.songs.length }} songs</div>
          </div>
          <div class="group-arrow">›</div>
        </div>
      </template>

      <!-- Playlists Tab -->
      <template v-else-if="activeTab === 'playlists'">
        <button class="create-playlist-btn" @click="showCreatePlaylist = true">+ Create Playlist</button>
        <div v-if="playlists.length === 0" class="empty">No playlists yet</div>
        <div
          v-for="pl in playlists"
          :key="pl.id"
          class="group-item"
          @click="openPlaylist(pl)"
        >
          <div class="group-icon playlist-icon">♪</div>
          <div class="group-info">
            <div class="group-name">{{ pl.name }}</div>
            <div class="group-meta">{{ pl.songIds.length }} songs</div>
          </div>
          <button class="del-playlist-btn" @click.stop="deletePlaylist(pl.id)" title="Delete playlist">×</button>
          <div class="group-arrow">›</div>
        </div>
      </template>
    </div>

    <!-- Create Playlist Modal -->
    <div v-if="showCreatePlaylist" class="modal-overlay" @click.self="showCreatePlaylist = false">
      <div class="modal">
        <div class="modal-title">Create Playlist</div>
        <input
          v-model="newPlaylistName"
          class="modal-input"
          placeholder="Playlist name..."
          @keyup.enter="createPlaylist()"
          ref="playlistInput"
        />
        <div class="modal-actions">
          <button class="modal-btn modal-btn-cancel" @click="showCreatePlaylist = false">Cancel</button>
          <button class="modal-btn modal-btn-ok" @click="createPlaylist()" :disabled="!newPlaylistName.trim()">Create</button>
        </div>
      </div>
    </div>

    <!-- Add to Playlist Modal -->
    <div v-if="showAddToPlaylist" class="modal-overlay" @click.self="showAddToPlaylist = null">
      <div class="modal">
        <div class="modal-title">Add to Playlist</div>
        <div v-if="playlists.length === 0" class="modal-empty">No playlists — create one first</div>
        <div
          v-for="pl in playlists"
          :key="pl.id"
          class="modal-playlist-item"
          @click="addToPlaylist(pl.id)"
        >
          {{ pl.name }} ({{ pl.songIds.length }})
        </div>
        <div class="modal-actions">
          <button class="modal-btn modal-btn-cancel" @click="showAddToPlaylist = null">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Context Menu -->
    <div v-if="contextMenu" class="context-menu" :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }" @click.stop>
      <div class="ctx-item" @click="contextAddToPlaylist()">Add to Playlist</div>
      <div class="ctx-item ctx-danger" @click="contextRemoveSong()">Remove from Library</div>
    </div>
    <div v-if="contextMenu" class="context-backdrop" @click="contextMenu = null"></div>

    <!-- Mini Player -->
    <div v-if="currentTrack" class="mini-player" @click="showNowPlaying = true">
      <div class="mini-progress" :style="{ width: progressPercent + '%' }"></div>
      <div class="mini-content">
        <div class="mini-info">
          <div class="mini-title">{{ currentTrack.title }}</div>
          <div class="mini-artist">{{ currentTrack.artist }}</div>
        </div>
        <div class="mini-controls">
          <button class="ctrl-btn" @click.stop="prev()">⏮</button>
          <button class="ctrl-btn play-btn" @click.stop="togglePlayPause()">
            {{ isPlaying ? '⏸' : '▶' }}
          </button>
          <button class="ctrl-btn" @click.stop="next()">⏭</button>
        </div>
        <div class="mini-volume" @click.stop>
          <span class="mini-vol-icon" @click.stop="setVolume(volume > 0 ? 0 : 80)">{{ volume == 0 ? '🔇' : volume < 40 ? '🔉' : '🔊' }}</span>
          <input
            type="range"
            class="mini-vol-bar"
            min="0"
            max="100"
            step="1"
            :value="volume"
            @input.stop="setVolume(Number($event.target.value))"
          />
        </div>
      </div>
    </div>

    <!-- Now Playing Overlay -->
    <div v-if="showNowPlaying && currentTrack" class="now-playing">
      <div class="np-header">
        <button class="np-close" @click="showNowPlaying = false">▼</button>
        <span class="np-label">Now Playing</span>
        <span></span>
      </div>

      <div class="np-art">
        <div class="np-disc" :class="{ spinning: isPlaying }">♫</div>
      </div>

      <div class="np-track-info">
        <div class="np-title">{{ currentTrack.title }}</div>
        <div class="np-artist">{{ currentTrack.artist }}</div>
        <div class="np-album">{{ currentTrack.album }}</div>
      </div>

      <div class="np-progress">
        <input
          type="range"
          class="seek-bar"
          min="0"
          :max="duration || 0"
          :value="progress"
          @input="seek(Number($event.target.value))"
        />
        <div class="np-times">
          <span>{{ formatTime(progress) }}</span>
          <span>{{ formatTime(duration) }}</span>
        </div>
      </div>

      <div class="np-controls">
        <button class="np-mode-btn" :class="{ active: shuffled }" @click="toggleShuffle()">
          <span class="mode-icon">⇄</span>
          <span class="mode-label">{{ shuffled ? 'ON' : 'OFF' }}</span>
        </button>
        <button class="np-btn" @click="prev()">⏮</button>
        <button class="np-btn np-play" @click="togglePlayPause()">
          {{ isPlaying ? '⏸' : '▶' }}
        </button>
        <button class="np-btn" @click="next()">⏭</button>
        <button class="np-mode-btn" :class="{ active: repeatMode !== 'off' }" @click="toggleRepeat()">
          <span class="mode-icon">{{ repeatMode === 'one' ? '🔂' : '🔁' }}</span>
          <span class="mode-label">{{ repeatMode === 'off' ? 'OFF' : repeatMode === 'one' ? 'ONE' : 'ALL' }}</span>
        </button>
      </div>

      <div class="np-volume">
        <span class="vol-icon" @click="setVolume(volume > 0 ? 0 : 80)">{{ volume == 0 ? '🔇' : volume < 40 ? '🔉' : '🔊' }}</span>
        <input
          type="range"
          class="volume-bar"
          min="0"
          max="100"
          step="1"
          :value="volume"
          @input="setVolume(Number($event.target.value))"
        />
        <span class="vol-pct">{{ Math.round(volume) }}%</span>
      </div>

      <!-- Equalizer -->
      <div class="np-eq-header" @click="showEq = !showEq">
        <span>Equalizer</span>
        <div class="eq-header-right">
          <button class="eq-toggle" :class="{ active: eqEnabled }" @click.stop="toggleEq()">
            {{ eqEnabled ? 'ON' : 'OFF' }}
          </button>
          <span class="eq-chevron">{{ showEq ? '▲' : '▼' }}</span>
        </div>
      </div>
      <div v-if="showEq" class="np-eq">
        <div class="eq-preset-row">
          <select class="eq-preset-select" :value="eqPreset" @change="setEqPreset($event.target.value)">
            <option v-for="name in eqPresetNames" :key="name" :value="name">{{ name }}</option>
            <option v-if="eqPreset === 'Custom'" value="Custom">Custom</option>
          </select>
        </div>
        <div class="eq-bands">
          <div class="eq-db-labels">
            <span>+12</span>
            <span>0</span>
            <span>-12</span>
          </div>
          <div v-for="(band, i) in eqBands" :key="band.freq" class="eq-band">
            <input
              type="range"
              class="eq-slider"
              min="-12"
              max="12"
              step="0.5"
              :value="band.gain"
              @input="setEqBand(i, Number($event.target.value))"
              orient="vertical"
            />
            <span class="eq-freq-label">{{ formatFreq(band.freq) }}</span>
          </div>
        </div>
      </div>

      <div class="np-queue-label" @click="showQueue = !showQueue">
        Up Next ({{ queue.length - currentIndex - 1 }}) {{ showQueue ? '▲' : '▼' }}
      </div>
      <div v-if="showQueue" class="np-queue">
        <div
          v-for="(track, i) in upNext"
          :key="track.id + '-' + i"
          class="np-queue-item"
          @click="jumpToQueue(i)"
        >
          <span class="np-queue-title">{{ track.title }}</span>
          <span class="np-queue-artist">{{ track.artist }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { usePlayer } from './composables/usePlayer.js'

const {
  library, queue, currentTrack, currentIndex, isPlaying, progress, duration,
  shuffled, repeatMode, volume, loading, scanStatus,
  playAll, playTrackFromList, togglePlayPause, next, prev,
  seek, setVolume, toggleShuffle, toggleRepeat, formatTime,
  eqBands, eqPreset, eqEnabled, EQ_PRESETS, EQ_FREQUENCIES,
  setEqBand, setEqPreset, toggleEq,
} = usePlayer()

const showEq = ref(false)
const eqPresetNames = Object.keys(EQ_PRESETS)

function formatFreq(f) {
  return f >= 1000 ? (f / 1000) + 'k' : String(f)
}

function folderName(dir) {
  const parts = dir.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || parts[parts.length - 2] || dir
}

const tabs = [
  { id: 'songs', label: 'Songs' },
  { id: 'albums', label: 'Albums' },
  { id: 'artists', label: 'Artists' },
  { id: 'genres', label: 'Genres' },
  { id: 'playlists', label: 'Playlists' },
]
const activeTab = ref('songs')
const search = ref('')
const showNowPlaying = ref(false)
const showQueue = ref(false)
const detailView = ref(null)
const customDirs = ref([])

// Playlists
const playlists = ref([])
const showCreatePlaylist = ref(false)
const newPlaylistName = ref('')
const showAddToPlaylist = ref(null) // song object or null
const playlistInput = ref(null)

// Context menu
const contextMenu = ref(null) // { x, y, song }

// Removed songs (persisted via localStorage)
const removedPaths = ref(new Set(JSON.parse(localStorage.getItem('mp-removed') || '[]')))

const api = window.electronAPI

const searchPlaceholder = computed(() => {
  if (detailView.value) return 'Search in ' + detailView.value.name + '...'
  const labels = { songs: 'songs', albums: 'albums', artists: 'artists', genres: 'genres', playlists: 'playlists' }
  return 'Search ' + (labels[activeTab.value] || 'songs') + '...'
})

// Songs (filtered by removed paths)
const visibleLibrary = computed(() => {
  return library.value.filter(s => !removedPaths.value.has(s.path))
})

const filteredSongs = computed(() => {
  if (!search.value) return visibleLibrary.value
  const q = search.value.toLowerCase()
  return visibleLibrary.value.filter(s =>
    s.title.toLowerCase().includes(q) ||
    s.artist.toLowerCase().includes(q) ||
    s.album.toLowerCase().includes(q) ||
    s.genre.toLowerCase().includes(q)
  )
})

// Albums
const albums = computed(() => {
  const map = {}
  for (const s of visibleLibrary.value) {
    const key = s.album + '|||' + s.artist
    if (!map[key]) map[key] = { name: s.album, artist: s.artist, songs: [] }
    map[key].songs.push(s)
  }
  const byName = {}
  for (const a of Object.values(map)) {
    if (!byName[a.name]) byName[a.name] = { name: a.name, artist: a.artist, songs: [] }
    byName[a.name].songs.push(...a.songs)
    if (byName[a.name].artist !== a.artist) byName[a.name].artist = 'Various Artists'
  }
  return Object.values(byName).sort((a, b) => a.name.localeCompare(b.name))
})

const filteredAlbums = computed(() => {
  if (!search.value) return albums.value
  const q = search.value.toLowerCase()
  return albums.value.filter(a => a.name.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q))
})

// Artists
const artists = computed(() => {
  const map = {}
  for (const s of visibleLibrary.value) {
    if (!map[s.artist]) map[s.artist] = { name: s.artist, songs: [], albumSet: new Set() }
    map[s.artist].songs.push(s)
    map[s.artist].albumSet.add(s.album)
  }
  return Object.values(map)
    .map(a => ({ name: a.name, songs: a.songs, albumCount: a.albumSet.size }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const filteredArtists = computed(() => {
  if (!search.value) return artists.value
  const q = search.value.toLowerCase()
  return artists.value.filter(a => a.name.toLowerCase().includes(q))
})

// Genres
const genres = computed(() => {
  const map = {}
  for (const s of visibleLibrary.value) {
    const key = s.genre
    if (!map[key]) map[key] = { name: key, songs: [], artistSet: new Set() }
    map[key].songs.push(s)
    map[key].artistSet.add(s.artist)
  }
  return Object.values(map)
    .map(g => ({ name: g.name, songs: g.songs, artistCount: g.artistSet.size }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const filteredGenres = computed(() => {
  if (!search.value) return genres.value
  const q = search.value.toLowerCase()
  return genres.value.filter(g => g.name.toLowerCase().includes(q))
})

const progressPercent = computed(() => {
  if (!duration.value) return 0
  return (progress.value / duration.value) * 100
})

const upNext = computed(() => {
  if (currentIndex.value < 0) return []
  return queue.value.slice(currentIndex.value + 1, currentIndex.value + 21)
})

function formatDuration(ms) {
  if (!ms) return '0:00'
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function playSong(song) { playTrackFromList(filteredSongs.value, song) }
function openDetail(type, name, songs) { detailView.value = { type, name, songs: [...songs] }; search.value = '' }
function closeDetail() { detailView.value = null; search.value = '' }
function playFromDetail(song) { playTrackFromList(detailView.value.songs, song) }

function playAllDetail() {
  if (detailView.value?.songs.length) playAll(detailView.value.songs, 0)
}

function shuffleDetail() {
  if (!detailView.value?.songs.length) return
  const songs = [...detailView.value.songs]
  for (let i = songs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [songs[i], songs[j]] = [songs[j], songs[i]]
  }
  playAll(songs, 0)
}

function jumpToQueue(offsetFromCurrent) {
  const idx = currentIndex.value + 1 + offsetFromCurrent
  if (idx < queue.value.length) playAll(queue.value, idx)
}

// Window controls
function minimize() { api?.windowMinimize() }
function maximize() { api?.windowMaximize() }
function closeWin() { api?.windowClose() }

// ─── Library loading ───

async function saveSettings() {
  if (api) await api.saveSettings({ folders: customDirs.value })
}

async function addFolder() {
  if (!api) return
  const folder = await api.pickFolder()
  if (folder && !customDirs.value.includes(folder)) {
    customDirs.value.push(folder)
    await saveSettings()
    await rescanMusic()
  }
}

async function removeFolder(folder) {
  customDirs.value = customDirs.value.filter(d => d !== folder)
  await saveSettings()
  if (customDirs.value.length > 0) {
    await rescanMusic()
  } else {
    library.value = []
  }
}

async function loadLibrary() {
  if (!api) return
  // Load saved folders
  const settings = await api.loadSettings() || {}
  if (settings.folders && settings.folders.length) {
    customDirs.value = settings.folders
  }
  // Try cache first
  const cached = await api.loadCachedLibrary()
  if (cached && cached.length > 0) {
    library.value = cached.sort((a, b) => a.title.localeCompare(b.title))
    loading.value = false
    return
  }
  // No cache — scan (saved folders or defaults)
  await rescanMusic()
}

async function rescanMusic() {
  loading.value = true
  scanStatus.value = 'Discovering files...'
  try {
    api?.onScanProgress((data) => {
      scanStatus.value = `Reading metadata... ${data.found}/${data.total} files`
    })
    // Pass saved folders if any, otherwise null lets main process use defaults
    const dirs = customDirs.value.length > 0 ? customDirs.value : null
    const songs = await api.scanLibrary(dirs)
    library.value = songs.sort((a, b) => a.title.localeCompare(b.title))
    scanStatus.value = ''
  } catch (e) {
    console.error('Scan failed:', e)
    scanStatus.value = 'Scan failed'
  } finally {
    loading.value = false
  }
}

// ─── Playlists ───

async function loadPlaylists() {
  if (!api) return
  playlists.value = await api.loadPlaylists() || []
}

async function savePlaylists() {
  if (api) await api.savePlaylists(playlists.value)
}

async function createPlaylist() {
  const name = newPlaylistName.value.trim()
  if (!name) return
  playlists.value.push({ id: Date.now().toString(), name, songIds: [] })
  await savePlaylists()
  newPlaylistName.value = ''
  showCreatePlaylist.value = false
}

async function deletePlaylist(id) {
  playlists.value = playlists.value.filter(p => p.id !== id)
  await savePlaylists()
}

function openPlaylist(pl) {
  const songMap = new Map(library.value.map(s => [s.id, s]))
  const songs = pl.songIds.map(id => songMap.get(id)).filter(Boolean).filter(s => !removedPaths.value.has(s.path))
  openDetail('playlist', pl.name, songs)
}

function openSongMenu(event, song) {
  contextMenu.value = { x: Math.min(event.clientX, window.innerWidth - 180), y: Math.min(event.clientY, window.innerHeight - 80), song }
}

function contextAddToPlaylist() {
  if (!contextMenu.value) return
  showAddToPlaylist.value = contextMenu.value.song
  contextMenu.value = null
}

async function addToPlaylist(playlistId) {
  const song = showAddToPlaylist.value
  if (!song) return
  const pl = playlists.value.find(p => p.id === playlistId)
  if (pl && !pl.songIds.includes(song.id)) {
    pl.songIds.push(song.id)
    await savePlaylists()
  }
  showAddToPlaylist.value = null
}

async function contextRemoveSong() {
  if (!contextMenu.value) return
  const song = contextMenu.value.song
  removedPaths.value.add(song.path)
  localStorage.setItem('mp-removed', JSON.stringify([...removedPaths.value]))
  // Also remove from any playlist
  for (const pl of playlists.value) {
    pl.songIds = pl.songIds.filter(id => id !== song.id)
  }
  await savePlaylists()
  // Update detail view if open
  if (detailView.value) {
    detailView.value.songs = detailView.value.songs.filter(s => s.id !== song.id)
  }
  contextMenu.value = null
}

// Auto-focus playlist name input when modal opens
watch(showCreatePlaylist, (val) => {
  if (val) nextTick(() => playlistInput.value?.focus())
})

onMounted(async () => {
  if (api) {
    await loadPlaylists()
    await loadLibrary()
  }
})
</script>

<style>
:root {
  --bg: #0a0a0a;
  --bg-light: #141414;
  --bg-card: #1a1a1a;
  --pink: #ff1493;
  --pink-dim: rgba(255, 20, 147, 0.3);
  --text: #e5e5e5;
  --text-muted: #888;
}

.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  user-select: none;
}

/* Titlebar */
.titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  padding: 0 8px 0 14px;
  background: #0e0e0e;
  -webkit-app-region: drag;
  flex-shrink: 0;
}
.titlebar-title {
  font-size: 12px;
  color: var(--text-muted);
  letter-spacing: 0.5px;
}
.titlebar-controls {
  display: flex;
  -webkit-app-region: no-drag;
}
.tb-btn {
  width: 36px;
  height: 32px;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tb-btn:hover { background: #2a2a2a; }
.tb-close:hover { background: #e81123; color: white; }

/* Header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px 6px;
  flex-shrink: 0;
}
.header h1 {
  font-size: 22px;
  font-weight: 700;
  color: var(--pink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.header-back {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  min-width: 0;
}
.back-arrow {
  font-size: 20px;
  color: var(--pink);
  flex-shrink: 0;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.song-count {
  color: var(--text-muted);
  font-size: 13px;
}
.folder-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--pink);
  border: none;
  color: white;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.folder-btn:hover { opacity: 0.85; }

/* Tabs */
.tabs {
  display: flex;
  gap: 4px;
  padding: 4px 16px 6px;
  flex-shrink: 0;
}
.tab {
  flex: 1;
  padding: 7px 0;
  background: var(--bg-card);
  border: 1px solid #333;
  border-radius: 8px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.tab.active {
  background: var(--pink);
  border-color: var(--pink);
  color: white;
}

/* Search */
.search-bar {
  padding: 4px 20px 8px;
  position: relative;
  flex-shrink: 0;
}
.search-input {
  width: 100%;
  padding: 8px 32px 8px 12px;
  background: var(--bg-card);
  border: 1px solid #333;
  border-radius: 8px;
  color: var(--text);
  font-size: 14px;
  outline: none;
}
.search-input:focus { border-color: var(--pink); }
.search-input::placeholder { color: #555; }
.clear-btn {
  position: absolute;
  right: 28px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 18px;
  cursor: pointer;
}

/* Content */
.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 0 10px;
  padding-bottom: 70px;
}
.content-area::-webkit-scrollbar { width: 5px; }
.content-area::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
.loading, .empty {
  text-align: center;
  color: var(--text-muted);
  padding: 50px 20px;
  font-size: 14px;
}
.scan-status {
  margin-top: 8px;
  font-size: 12px;
  color: var(--pink);
}

/* Detail header */
.detail-header-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 12px 10px;
}
.detail-meta { color: var(--text-muted); font-size: 12px; }
.detail-actions { display: flex; gap: 6px; }
.action-btn {
  padding: 5px 12px;
  background: var(--pink);
  border: none;
  border-radius: 16px;
  color: white;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.action-btn-outline {
  background: transparent;
  border: 1px solid var(--pink);
  color: var(--pink);
}

/* Song items */
.song-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.1s;
}
.song-item:hover { background: var(--bg-card); }
.song-item.active { background: var(--pink-dim); }
.song-item.active .song-title { color: var(--pink); }
.song-info { flex: 1; min-width: 0; margin-right: 10px; }
.song-title {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text);
}
.song-artist {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.song-duration { font-size: 12px; color: var(--text-muted); flex-shrink: 0; }

/* Group items */
.group-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  gap: 12px;
  transition: background 0.1s;
}
.group-item:hover { background: var(--bg-card); }
.group-icon {
  width: 42px;
  height: 42px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
.album-icon { background: linear-gradient(135deg, #2a1a2e, #1a1a2e); border: 1px solid #333; }
.artist-icon { background: linear-gradient(135deg, #1a2e1a, #1a2a2e); border: 1px solid #333; border-radius: 50%; }
.genre-icon { background: linear-gradient(135deg, #2e1a1a, #2e2a1a); border: 1px solid #333; }
.group-info { flex: 1; min-width: 0; }
.group-name { font-size: 14px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.group-meta { font-size: 12px; color: var(--text-muted); margin-top: 1px; }
.group-arrow { font-size: 18px; color: #444; }

/* Mini Player */
.mini-player {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-light);
  border-top: 1px solid #222;
  z-index: 10;
  cursor: pointer;
}
.mini-progress { height: 2px; background: var(--pink); transition: width 0.3s linear; }
.mini-content { display: flex; align-items: center; justify-content: space-between; padding: 8px 14px; }
.mini-info { flex: 1; min-width: 0; margin-right: 10px; }
.mini-title { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mini-artist { font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mini-controls { display: flex; align-items: center; gap: 6px; }
.ctrl-btn { background: none; border: none; color: var(--text); font-size: 16px; cursor: pointer; padding: 5px; line-height: 1; }
.play-btn { font-size: 20px; }

/* Now Playing */
.now-playing {
  position: fixed;
  inset: 0;
  background: var(--bg);
  z-index: 100;
  display: flex;
  flex-direction: column;
  padding: 0 20px 16px;
  animation: slideUp 0.2s ease-out;
  overflow-y: auto;
}
@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.np-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; flex-shrink: 0; }
.np-close { background: none; border: none; color: var(--text-muted); font-size: 18px; cursor: pointer; padding: 4px; }
.np-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }

.np-art { flex-shrink: 0; display: flex; align-items: center; justify-content: center; padding: 16px 0; }
.np-disc {
  width: 180px; height: 180px; border-radius: 50%;
  background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
  border: 3px solid var(--pink);
  display: flex; align-items: center; justify-content: center;
  font-size: 50px;
  box-shadow: 0 0 30px rgba(255, 20, 147, 0.15);
}
.np-disc.spinning { animation: spin 4s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.np-track-info { text-align: center; padding: 6px 0; flex-shrink: 0; }
.np-title { font-size: 18px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.np-artist { font-size: 14px; color: var(--pink); }
.np-album { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

.np-progress { padding: 10px 0 4px; flex-shrink: 0; }
.seek-bar { width: 100%; -webkit-appearance: none; height: 4px; background: #333; border-radius: 2px; outline: none; }
.seek-bar::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: var(--pink); cursor: pointer; }
.np-times { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-top: 4px; }

.np-controls { display: flex; align-items: center; justify-content: center; gap: 16px; padding: 8px 0; flex-shrink: 0; }
.np-btn { background: none; border: none; color: var(--text); font-size: 22px; cursor: pointer; padding: 6px; opacity: 0.8; }
.np-btn:hover { opacity: 1; }
.np-btn.active { color: var(--pink); opacity: 1; }
.np-mode-btn {
  background: #1a1a1a; border: 1.5px solid #333; border-radius: 8px;
  color: var(--text-muted); cursor: pointer; padding: 4px 8px;
  display: flex; flex-direction: column; align-items: center; gap: 1px;
  min-width: 44px; transition: all 0.15s;
}
.np-mode-btn:hover { border-color: #555; }
.np-mode-btn.active { border-color: var(--pink); background: rgba(255, 20, 147, 0.12); color: var(--pink); }
.mode-icon { font-size: 18px; line-height: 1; }
.mode-label { font-size: 9px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
.np-play {
  font-size: 32px; width: 56px; height: 56px; border-radius: 50%;
  background: var(--pink); color: white;
  display: flex; align-items: center; justify-content: center; opacity: 1;
}

.np-volume { display: flex; align-items: center; gap: 10px; padding: 6px 0; flex-shrink: 0; }
.vol-icon { font-size: 16px; cursor: pointer; min-width: 20px; text-align: center; }
.volume-bar { flex: 1; -webkit-appearance: none; height: 4px; background: #333; border-radius: 2px; outline: none; }
.volume-bar::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: var(--pink); cursor: pointer; box-shadow: 0 0 4px rgba(255, 20, 147, 0.4); }
.vol-pct { font-size: 12px; color: var(--text-muted); min-width: 32px; text-align: right; font-variant-numeric: tabular-nums; }

.np-queue-label { text-align: center; font-size: 12px; color: var(--text-muted); padding: 8px 0 4px; cursor: pointer; flex-shrink: 0; }
.np-queue { flex: 1; overflow-y: auto; min-height: 0; }
.np-queue::-webkit-scrollbar { width: 4px; }
.np-queue::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
.np-queue-item { display: flex; justify-content: space-between; padding: 6px 4px; border-bottom: 1px solid #1a1a1a; cursor: pointer; }
.np-queue-item:hover { background: var(--bg-card); }
.np-queue-title { font-size: 12px; color: var(--text); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-right: 8px; }
.np-queue-artist { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }

/* Equalizer */
.np-eq-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 4px; cursor: pointer; flex-shrink: 0;
  font-size: 13px; color: var(--text-muted);
  border-top: 1px solid #1a1a1a; margin-top: 4px;
}
.eq-header-right { display: flex; align-items: center; gap: 8px; }
.eq-chevron { font-size: 10px; }
.eq-toggle {
  padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700;
  letter-spacing: 0.5px; cursor: pointer; border: 1px solid #444;
  background: #1a1a1a; color: var(--text-muted); transition: all 0.15s;
}
.eq-toggle.active { border-color: var(--pink); background: rgba(255, 20, 147, 0.15); color: var(--pink); }

.np-eq { flex-shrink: 0; padding: 0 4px 6px; }
.eq-preset-row { margin-bottom: 8px; }
.eq-preset-select {
  width: 100%; padding: 6px 10px; background: var(--bg-card); border: 1px solid #333;
  border-radius: 8px; color: var(--text); font-size: 13px; outline: none; cursor: pointer;
  -webkit-appearance: none;
}
.eq-preset-select:focus { border-color: var(--pink); }
.eq-preset-select option { background: #1a1a1a; color: var(--text); }

.eq-bands {
  display: flex; align-items: flex-start; gap: 2px;
  padding: 4px 0;
}
.eq-db-labels {
  display: flex; flex-direction: column; justify-content: space-between;
  height: 100px; font-size: 9px; color: #555; padding: 2px 4px 18px 0;
  flex-shrink: 0; min-width: 20px; text-align: right;
}
.eq-band {
  display: flex; flex-direction: column; align-items: center; flex: 1;
}
.eq-freq-label { font-size: 9px; color: #555; margin-top: 4px; }

.eq-slider {
  -webkit-appearance: slider-vertical; width: 16px; height: 100px;
  background: transparent; outline: none; cursor: pointer;
}
.eq-slider::-webkit-slider-runnable-track {
  width: 4px; background: #333; border-radius: 2px;
}
.eq-slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%;
  background: var(--pink); cursor: pointer;
  box-shadow: 0 0 4px rgba(255, 20, 147, 0.4);
}

/* Saved Folders */
.saved-folders {
  display: flex; align-items: center; gap: 6px;
  padding: 2px 16px 4px; flex-shrink: 0; overflow-x: auto;
}
.saved-folders::-webkit-scrollbar { height: 0; }
.saved-folders-label { font-size: 11px; color: #555; flex-shrink: 0; }
.saved-folder-chips { display: flex; gap: 4px; flex-wrap: nowrap; overflow-x: auto; }
.saved-folder-chips::-webkit-scrollbar { height: 0; }
.folder-chip {
  display: flex; align-items: center; gap: 3px;
  padding: 2px 6px 2px 8px; background: var(--bg-card); border: 1px solid #2a2a2a;
  border-radius: 12px; flex-shrink: 0;
}
.folder-chip-name {
  font-size: 11px; color: var(--text-muted); max-width: 100px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.folder-chip-remove {
  background: none; border: none; color: #555; font-size: 13px;
  cursor: pointer; padding: 0 1px; line-height: 1;
}
.folder-chip-remove:hover { color: #e55; }

/* Rescan button */
.header-icon-btn {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--bg-card); border: 1px solid #333;
  color: var(--text-muted); font-size: 16px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.header-icon-btn:hover { border-color: var(--pink); color: var(--pink); }

/* Playlist icon & delete btn */
.playlist-icon { background: linear-gradient(135deg, #1a1a2e, #2a1a2e); border: 1px solid #333; }
.del-playlist-btn {
  background: none; border: none; color: #555; font-size: 16px;
  cursor: pointer; padding: 2px 6px; flex-shrink: 0;
}
.del-playlist-btn:hover { color: #e55; }

/* Create Playlist button */
.create-playlist-btn {
  display: block; width: calc(100% - 24px); margin: 6px 12px 10px;
  padding: 10px; background: var(--bg-card); border: 1.5px dashed #444;
  border-radius: 10px; color: var(--pink); font-size: 14px; font-weight: 600;
  cursor: pointer; text-align: center; transition: all 0.15s;
}
.create-playlist-btn:hover { border-color: var(--pink); background: rgba(255, 20, 147, 0.06); }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6);
  z-index: 200; display: flex; align-items: center; justify-content: center;
}
.modal {
  background: #1c1c1c; border: 1px solid #333; border-radius: 14px;
  padding: 20px; width: 300px; max-width: 90vw;
}
.modal-title { font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 14px; }
.modal-input {
  width: 100%; padding: 9px 12px; background: var(--bg); border: 1px solid #444;
  border-radius: 8px; color: var(--text); font-size: 14px; outline: none;
}
.modal-input:focus { border-color: var(--pink); }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.modal-btn {
  padding: 7px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
  cursor: pointer; border: none;
}
.modal-btn-cancel { background: #333; color: var(--text-muted); }
.modal-btn-cancel:hover { background: #444; }
.modal-btn-ok { background: var(--pink); color: white; }
.modal-btn-ok:hover { opacity: 0.9; }
.modal-btn-ok:disabled { opacity: 0.4; cursor: not-allowed; }
.modal-empty { color: var(--text-muted); font-size: 13px; padding: 12px 0; text-align: center; }
.modal-playlist-item {
  padding: 10px 12px; border-radius: 8px; cursor: pointer;
  color: var(--text); font-size: 14px; transition: background 0.1s;
}
.modal-playlist-item:hover { background: var(--pink-dim); }

/* Context menu */
.context-backdrop { position: fixed; inset: 0; z-index: 149; }
.context-menu {
  position: fixed; z-index: 150; background: #1e1e1e; border: 1px solid #333;
  border-radius: 10px; padding: 4px 0; min-width: 170px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}
.ctx-item {
  padding: 9px 14px; font-size: 13px; color: var(--text); cursor: pointer;
  transition: background 0.1s;
}
.ctx-item:hover { background: var(--bg-card); }
.ctx-danger { color: #e55; }
.ctx-danger:hover { background: rgba(238, 85, 85, 0.1); }

/* Mini Player volume */
.mini-volume {
  display: flex; align-items: center; gap: 4px; margin-left: 6px; flex-shrink: 0;
}
.mini-vol-icon { font-size: 14px; cursor: pointer; min-width: 18px; text-align: center; }
.mini-vol-bar {
  width: 60px; -webkit-appearance: none; height: 3px; background: #333;
  border-radius: 2px; outline: none; cursor: pointer;
}
.mini-vol-bar::-webkit-slider-thumb {
  -webkit-appearance: none; width: 10px; height: 10px; border-radius: 50%;
  background: var(--pink); cursor: pointer;
}
</style>
