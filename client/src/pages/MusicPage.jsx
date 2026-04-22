import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { getSocket } from '../lib/socket'
import { getDeviceId } from '../lib/api'
import s from './MusicPage.module.css'

const BASE = import.meta.env.BASE_URL

function msToMin(ms) {
  const m   = Math.floor(ms / 60000)
  const sec = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0')
  return `${m}:${sec}`
}

function IgIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  )
}

export default function MusicPage() {
  const { eventId } = useParams()

  const [eventName, setEventName]       = useState('')
  const [available, setAvailable]       = useState(null)
  const [brandLogo, setBrandLogo]       = useState('')
  const [brandIg, setBrandIg]           = useState('topdjgroup')
  const [query, setQuery]               = useState('')
  const [tracks, setTracks]             = useState([])
  const [searching, setSearching]       = useState(false)
  const [requests, setRequests]         = useState([])
  const [requested, setRequested]       = useState(new Set())
  const [toast, setToast]               = useState({ msg: '', type: '', v: false })
  const [preview, setPreview]           = useState(null)
  const [previewProgress, setProgress]  = useState(0)
  const [cooldown, setCooldown]         = useState(0)
  const audioRef     = useRef(null)
  const progressRef  = useRef(null)
  const toastRef     = useRef(null)
  const debounceRef  = useRef(null)
  const lastSearched = useRef('')
  const cooldownRef  = useRef(null)

  useEffect(() => {
    fetch(`${BASE}api/e/${eventId}/music/info`, { headers: { 'X-Device-ID': getDeviceId() } })
      .then(r => r.json())
      .then(d => {
        setEventName(d.name || '')
        setAvailable(!!(d.active && d.music_enabled))
        if (d.brand_logo_url) setBrandLogo(d.brand_logo_url)
        if (d.brand_instagram) setBrandIg(d.brand_instagram)
        if (d.rateLimit?.retryAfter > 0) startCooldown(d.rateLimit.retryAfter)
      })
      .catch(() => setAvailable(false))
  }, [eventId]) // eslint-disable-line

  useEffect(() => {
    if (!eventId) return
    const socket = getSocket(eventId)
    const onEstado      = ({ musicRequests }) => { if (musicRequests) setRequests(musicRequests) }
    const onNueva       = (r)                 => setRequests(prev => [...prev, r])
    const onActualizada = ({ id, status })    => setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    const onEliminada   = ({ id })            => setRequests(prev => prev.filter(r => r.id !== id))
    socket.on('estado_inicial',    onEstado)
    socket.on('music_nueva',       onNueva)
    socket.on('music_actualizada', onActualizada)
    socket.on('music_eliminada',   onEliminada)
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

  const doSearch = useCallback(async (q) => {
    if (q.length < 2) { setTracks([]); return }
    if (q === lastSearched.current) return
    lastSearched.current = q
    setSearching(true)
    try {
      const r = await fetch(`${BASE}api/e/${eventId}/music/search?q=${encodeURIComponent(q)}`)
      const d = await r.json()
      if (!r.ok) { showToast(d.error || 'Error al buscar', 'error'); return }
      setTracks(d.tracks || [])
    } catch {
      showToast('Error de conexión', 'error')
    } finally {
      setSearching(false)
    }
  }, [eventId, showToast])

  const onQueryChange = (e) => {
    const v = e.target.value
    setQuery(v)
    clearTimeout(debounceRef.current)
    if (!v.trim()) { setTracks([]); lastSearched.current = ''; return }
    debounceRef.current = setTimeout(() => doSearch(v.trim()), 800)
  }

  const startCooldown = (secs) => {
    setCooldown(secs)
    clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setCooldown(c => {
        if (c <= 1) { clearInterval(cooldownRef.current); return 0 }
        return c - 1
      })
    }, 1000)
  }

  const requestTrack = async (track) => {
    try {
      const r = await fetch(`${BASE}api/e/${eventId}/music/requests`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Device-ID': getDeviceId() },
        body: JSON.stringify({
          trackId:    track.id,
          trackName:  track.name,
          artistName: track.artist,
          albumName:  track.album,
          albumArt:   track.albumArt,
          previewUrl: track.previewUrl,
        }),
      })
      const d = await r.json()
      if (r.status === 429) { startCooldown(d.retryAfter || 60); return }
      if (!r.ok) { showToast(d.error || 'Error al pedir', 'error'); return }
      setRequested(prev => new Set([...prev, track.id]))
      showToast(`¡Pedido! ${track.artist} — ${track.name}`, 'success')
      if ((d.remaining ?? 1) === 0) startCooldown(d.retryAfter || 60)
    } catch {
      showToast('Error de conexión', 'error')
    }
  }

  const stopProgress = () => { clearInterval(progressRef.current); setProgress(0) }

  const startProgress = () => {
    clearInterval(progressRef.current)
    setProgress(0)
    const audio = audioRef.current
    progressRef.current = setInterval(() => {
      if (!audio || !audio.duration) return
      setProgress((audio.currentTime / audio.duration) * 100)
    }, 250)
  }

  const togglePreview = (track) => {
    if (!track.previewUrl) return
    const audio = audioRef.current
    if (!audio) return
    if (preview === track.id) {
      audio.pause(); stopProgress(); setPreview(null); return
    }
    audio.pause()
    audio.src = track.previewUrl
    audio.load()
    audio.play()
      .then(() => { setPreview(track.id); startProgress() })
      .catch(() => showToast('No se pudo reproducir el preview', 'error'))
  }

  const onAudioEnded = () => { stopProgress(); setPreview(null) }

  const alreadyRequested = (trackId) => {
    if (requested.has(trackId)) return true
    return requests.some(r => r.track_id === trackId && (r.status === 'pending' || r.status === 'playing'))
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (available === null) {
    return (
      <div className={s.loadingScreen}>
        <img src={brandLogo || `${BASE}logo.png`} alt="logo" className={s.loadingLogo} />
        <div className={s.spinner} />
      </div>
    )
  }

  // ── Not available ─────────────────────────────────────────────────────────
  if (!available) {
    return (
      <div className={s.unavailable}>
        <img src={brandLogo || `${BASE}logo.png`} alt="logo" className={s.unavailableLogo} />
        <div className={s.unavailableTitle}>Música no disponible</div>
        <div className={s.unavailableSub}>Este evento no tiene la función de pedidos activada.</div>
        <a href={`https://www.instagram.com/${brandIg}`} target="_blank" rel="noreferrer" className={s.igBtnStandalone}>
          <IgIcon /> Seguinos en Instagram
        </a>
      </div>
    )
  }

  // ── Main ──────────────────────────────────────────────────────────────────
  return (
    <div className={s.page}>
      <audio ref={audioRef} onEnded={onAudioEnded} />

      {/* ── Hero header ── */}
      <div className={s.hero}>
        <div className={s.heroBg} />
        <img src={brandLogo || `${BASE}logo.png`} alt="logo" className={s.heroLogo} />
        <div className={s.heroTagline}>Pedí tu tema</div>
        {eventName && <div className={s.heroEvent}>{eventName}</div>}
      </div>

      {/* ── Search ── */}
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

      {/* ── Cooldown banner ── */}
      {cooldown > 0 && (
        <div className={s.cooldownBanner}>
          <span className={s.cooldownIcon}>⏳</span>
          <span>Ya mandaste tus pedidos · podés pedir de nuevo en <strong>{cooldown}s</strong></span>
        </div>
      )}

      {/* ── Search results ── */}
      {tracks.length > 0 && (
        <div className={s.results}>
          {tracks.map(track => {
            const done        = alreadyRequested(track.id)
            const isPreviewing = preview === track.id
            return (
              <div key={track.id} className={`${s.trackCard} ${isPreviewing ? s.trackCardPreviewing : ''}`}>
                <div
                  className={`${s.trackArtWrap} ${track.previewUrl ? s.trackArtHasPreview : ''}`}
                  onClick={() => togglePreview(track)}
                >
                  {track.albumArt
                    ? <img src={track.albumArt} alt="" className={s.trackArt} />
                    : <div className={s.trackArtPlaceholder}>🎵</div>
                  }
                  {track.previewUrl && (
                    <>
                      <div className={`${s.previewBtn} ${isPreviewing ? s.previewBtnActive : ''}`}>
                        {isPreviewing ? '⏸' : '▶'}
                      </div>
                      {isPreviewing && (
                        <svg className={s.previewRing} viewBox="0 0 54 54">
                          <circle cx="27" cy="27" r="24" fill="none" stroke="rgba(0,232,144,.2)" strokeWidth="3" />
                          <circle cx="27" cy="27" r="24"
                            fill="none" stroke="#00e890" strokeWidth="3"
                            strokeDasharray={`${2 * Math.PI * 24}`}
                            strokeDashoffset={`${2 * Math.PI * 24 * (1 - previewProgress / 100)}`}
                            strokeLinecap="round"
                            transform="rotate(-90 27 27)"
                            style={{ transition: 'stroke-dashoffset .25s linear' }}
                          />
                        </svg>
                      )}
                    </>
                  )}
                </div>
                <div className={s.trackInfo}>
                  <div className={s.trackName}>{track.name}</div>
                  <div className={s.trackArtist}>{track.artist}</div>
                  <div className={s.trackMeta}>
                    {track.album} · {msToMin(track.durationMs)}
                  </div>
                </div>
                <button
                  className={`${s.btnPedir} ${done || cooldown > 0 ? s.btnPedirDone : ''} ${cooldown > 0 && !done ? s.btnPedirCooldown : ''}`}
                  onClick={() => !done && !cooldown && requestTrack(track)}
                  disabled={done || cooldown > 0}
                >
                  {done ? '✓' : cooldown > 0 ? `${cooldown}s` : 'Pedir'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Empty search ── */}
      {query.length >= 2 && !searching && tracks.length === 0 && query.trim() === lastSearched.current && (
        <div className={s.emptySearch}>
          <div className={s.emptyIcon}>🔍</div>
          <div>No encontramos resultados para "{query}"</div>
        </div>
      )}

      {/* ── Hint (idle state) ── */}
      {!query && tracks.length === 0 && (
        <div className={s.hint}>
          <div className={s.hintIcon}>🎶</div>
          <div className={s.hintText}>
            Escribí el nombre de una canción o artista para buscar en Spotify
          </div>
        </div>
      )}

      {/* ── Instagram sticky footer ── */}
      <div className={s.igFooter}>
        <span className={s.igFooterText}>¿Te gustó la noche?</span>
        <a href={`https://www.instagram.com/${brandIg}`} target="_blank" rel="noreferrer" className={s.igBtn}>
          <IgIcon />
          Seguinos @{brandIg}
        </a>
      </div>

      <div className={`${s.toast} ${toast.v ? s.toastShow : ''} ${toast.type === 'success' ? s.toastSuccess : ''} ${toast.type === 'error' ? s.toastError : ''}`}>
        {toast.msg}
      </div>
    </div>
  )
}
