import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { getSocket } from '../lib/socket'
import s from './MusicPage.module.css'

const BASE = import.meta.env.BASE_URL

function msToMin(ms) {
  const m = Math.floor(ms / 60000)
  const sec = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0')
  return `${m}:${sec}`
}

export default function MusicPage() {
  const { eventId } = useParams()

  const [eventName, setEventName]   = useState('')
  const [available, setAvailable]   = useState(null) // null=loading, true/false
  const [query, setQuery]           = useState('')
  const [tracks, setTracks]         = useState([])
  const [searching, setSearching]   = useState(false)
  const [requests, setRequests]     = useState([])
  const [requested, setRequested]   = useState(new Set()) // trackIds ya pedidos
  const [toast, setToast]           = useState({ msg: '', type: '', v: false })
  const [preview, setPreview]       = useState(null) // trackId en preview
  const audioRef  = useRef(null)
  const toastRef  = useRef(null)
  const debounceRef = useRef(null)

  // Load event info
  useEffect(() => {
    fetch(`${BASE}api/e/${eventId}/music/info`)
      .then(r => r.json())
      .then(d => {
        setEventName(d.name || '')
        setAvailable(!!(d.active && d.music_enabled))
      })
      .catch(() => setAvailable(false))
  }, [eventId])

  // Socket.io: subscribe to real-time updates
  useEffect(() => {
    if (!eventId) return
    const socket = getSocket(eventId)

    const onEstado = ({ musicRequests }) => {
      if (musicRequests) setRequests(musicRequests)
    }
    const onNueva      = (r)           => setRequests(prev => [...prev, r])
    const onActualizada = ({ id, status }) => setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    const onEliminada  = ({ id })      => setRequests(prev => prev.filter(r => r.id !== id))

    socket.on('estado_inicial',  onEstado)
    socket.on('music_nueva',     onNueva)
    socket.on('music_actualizada', onActualizada)
    socket.on('music_eliminada', onEliminada)

    return () => {
      socket.off('estado_inicial',    onEstado)
      socket.off('music_nueva',       onNueva)
      socket.off('music_actualizada', onActualizada)
      socket.off('music_eliminada',   onEliminada)
    }
  }, [eventId])

  const showToast = useCallback((msg, type = '') => {
    clearTimeout(toastRef.current)
    setToast({ msg, type, v: true })
    toastRef.current = setTimeout(() => setToast(t => ({ ...t, v: false })), 2800)
  }, [])

  // Spotify search with debounce
  const doSearch = useCallback(async (q) => {
    if (q.length < 2) { setTracks([]); return }
    setSearching(true)
    try {
      const r = await fetch(`${BASE}api/e/${eventId}/music/search?q=${encodeURIComponent(q)}`)
      const d = await r.json()
      setTracks(d.tracks || [])
    } catch {
      showToast('Error al buscar', 'error')
    } finally {
      setSearching(false)
    }
  }, [eventId, showToast])

  const onQueryChange = (e) => {
    const v = e.target.value
    setQuery(v)
    clearTimeout(debounceRef.current)
    if (!v.trim()) { setTracks([]); return }
    debounceRef.current = setTimeout(() => doSearch(v.trim()), 450)
  }

  const requestTrack = async (track) => {
    try {
      const r = await fetch(`${BASE}api/e/${eventId}/music/requests`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          trackId:    track.id,
          trackName:  track.name,
          artistName: track.artist,
          albumName:  track.album,
          albumArt:   track.albumArt,
          previewUrl: track.previewUrl,
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        showToast(d.error || 'Error al pedir', 'error')
        return
      }
      setRequested(prev => new Set([...prev, track.id]))
      showToast(`¡Pedido! ${track.artist} — ${track.name}`, 'success')
    } catch {
      showToast('Error de conexión', 'error')
    }
  }

  const togglePreview = (track) => {
    if (!track.previewUrl) return
    if (preview === track.id) {
      audioRef.current?.pause()
      setPreview(null)
      return
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = track.previewUrl
      audioRef.current.play().catch(() => {})
    }
    setPreview(track.id)
  }

  const alreadyRequested = (trackId) => {
    if (requested.has(trackId)) return true
    return requests.some(r => r.track_id === trackId && (r.status === 'pending' || r.status === 'playing'))
  }

  const pendingRequests = requests.filter(r => r.status === 'pending')
  const playingRequest  = requests.find(r => r.status === 'playing')

  if (available === null) {
    return (
      <div className={s.loadingScreen}>
        <div className={s.spinner} />
      </div>
    )
  }

  if (!available) {
    return (
      <div className={s.unavailable}>
        <div className={s.unavailableIcon}>🎵</div>
        <div className={s.unavailableTitle}>Música no disponible</div>
        <div className={s.unavailableSub}>Este evento no tiene la función de pedidos activada.</div>
      </div>
    )
  }

  return (
    <div className={s.page}>
      <audio ref={audioRef} onEnded={() => setPreview(null)} />

      {/* Header */}
      <div className={s.header}>
        <div className={s.headerIcon}>🎵</div>
        <div className={s.headerText}>
          <div className={s.headerTitle}>Pedí tu tema</div>
          {eventName && <div className={s.headerSub}>{eventName}</div>}
        </div>
      </div>

      {/* Now playing */}
      {playingRequest && (
        <div className={s.nowPlaying}>
          {playingRequest.album_art && (
            <img src={playingRequest.album_art} alt="" className={s.nowPlayingArt} />
          )}
          <div className={s.nowPlayingInfo}>
            <div className={s.nowPlayingLabel}>Sonando ahora</div>
            <div className={s.nowPlayingName}>{playingRequest.track_name}</div>
            <div className={s.nowPlayingArtist}>{playingRequest.artist_name}</div>
          </div>
          <div className={s.equalizerBars}>
            <span /><span /><span /><span />
          </div>
        </div>
      )}

      {/* Search */}
      <div className={s.searchWrap}>
        <div className={s.searchBox}>
          <svg className={s.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className={s.searchInput}
            type="search"
            placeholder="Buscá artista o canción..."
            value={query}
            onChange={onQueryChange}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {searching && <div className={s.searchSpinner} />}
          {query && !searching && (
            <button className={s.searchClear} onClick={() => { setQuery(''); setTracks([]) }}>✕</button>
          )}
        </div>
      </div>

      {/* Search results */}
      {tracks.length > 0 && (
        <div className={s.results}>
          {tracks.map(track => {
            const done = alreadyRequested(track.id)
            const isPreviewing = preview === track.id
            return (
              <div key={track.id} className={s.trackCard}>
                <div className={s.trackArtWrap} onClick={() => togglePreview(track)}>
                  {track.albumArt
                    ? <img src={track.albumArt} alt="" className={s.trackArt} />
                    : <div className={s.trackArtPlaceholder}>🎵</div>
                  }
                  {track.previewUrl && (
                    <div className={`${s.previewBtn} ${isPreviewing ? s.previewBtnActive : ''}`}>
                      {isPreviewing ? '⏸' : '▶'}
                    </div>
                  )}
                </div>
                <div className={s.trackInfo}>
                  <div className={s.trackName}>{track.name}</div>
                  <div className={s.trackArtist}>{track.artist}</div>
                  <div className={s.trackMeta}>{track.album} · {msToMin(track.durationMs)}</div>
                </div>
                <button
                  className={`${s.btnPedir} ${done ? s.btnPedirDone : ''}`}
                  onClick={() => !done && requestTrack(track)}
                  disabled={done}
                >
                  {done ? '✓' : 'Pedir'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty search state */}
      {query.length >= 2 && !searching && tracks.length === 0 && (
        <div className={s.emptySearch}>
          <div className={s.emptyIcon}>🔍</div>
          <div>No encontramos resultados para "{query}"</div>
        </div>
      )}

      {/* Queue */}
      {pendingRequests.length > 0 && (
        <div className={s.queue}>
          <div className={s.queueTitle}>Cola de pedidos</div>
          {pendingRequests.map((r, i) => (
            <div key={r.id} className={s.queueItem}>
              <div className={s.queueNum}>{i + 1}</div>
              {r.album_art
                ? <img src={r.album_art} alt="" className={s.queueArt} />
                : <div className={s.queueArtPlaceholder}>🎵</div>
              }
              <div className={s.queueInfo}>
                <div className={s.queueName}>{r.track_name}</div>
                <div className={s.queueArtist}>{r.artist_name}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Landing hint when no search */}
      {!query && tracks.length === 0 && pendingRequests.length === 0 && !playingRequest && (
        <div className={s.hint}>
          <div className={s.hintIcon}>🎶</div>
          <div className={s.hintText}>Escribí el nombre de una canción o artista para buscar en Spotify</div>
        </div>
      )}

      <div className={`${s.toast} ${toast.v ? s.toastShow : ''} ${toast.type === 'success' ? s.toastSuccess : ''} ${toast.type === 'error' ? s.toastError : ''}`}>
        {toast.msg}
      </div>
    </div>
  )
}
