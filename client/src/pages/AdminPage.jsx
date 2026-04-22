import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getSocket, disconnectSocket } from '../lib/socket'
import { authFetch, decodeToken, clearToken } from '../lib/api'
import s from './AdminPage.module.css'

const INTERVALS = [3, 5, 10, 15]
const BASE = import.meta.env.BASE_URL

export default function AdminPage() {
  const navigate          = useNavigate()
  const { eventId: paramId } = useParams()
  const payload           = decodeToken()
  const eventId           = paramId ?? payload?.eventId

  // Photos state
  const [photos, setPhotos]         = useState([])
  const [currentId, setCurrentId]   = useState(null)
  const [ssActive, setSsActive]     = useState(false)
  const [ssInterval, setSsInterval] = useState(3)
  const [qr, setQr]                 = useState(null)
  const [connected, setConnected]   = useState(false)
  const [toast, setToast]           = useState({ msg: '', type: '', visible: false })
  const toastTimer = useRef(null)
  const socketRef  = useRef(null)

  // Music state
  const [musicEnabled, setMusicEnabled]   = useState(false)
  const [musicRequests, setMusicRequests] = useState([])
  const [musicQr, setMusicQr]             = useState(null)

  const logout = () => {
    disconnectSocket()
    clearToken()
    navigate('/login', { replace: true })
  }

  const showToast = (msg, type = '') => {
    clearTimeout(toastTimer.current)
    setToast({ msg, type, visible: true })
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2500)
  }

  useEffect(() => {
    if (!eventId) return
    const socket = getSocket(eventId)
    socketRef.current = socket

    const onConnect    = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    const onEstado     = ({ current, photos: ph, musicRequests: mr, musicEnabled: me }) => {
      setPhotos(ph || [])
      setCurrentId(current?.id ?? null)
      if (mr) setMusicRequests(mr)
      if (me !== undefined) setMusicEnabled(!!me)
    }
    const onNueva      = (photo)          => { setPhotos((prev) => [{ ...photo, _new: true }, ...prev]); showToast('📸 Nueva foto recibida', 'green') }
    const onEliminada  = ({ id })         => { setPhotos((prev) => prev.filter((p) => p.id !== id)); setCurrentId((cur) => (cur === id ? null : cur)) }
    const onMostrar    = (photo)          => setCurrentId(photo?.id ?? null)
    const onSlideshow  = ({ active })     => setSsActive(active)
    const onActualizada = ({ id, inSlideshow }) => setPhotos((prev) => prev.map((p) => p.id === id ? { ...p, inSlideshow } : p))

    // Music socket events
    const onMusicNueva       = (r)               => { setMusicRequests(prev => [...prev, r]); showToast(`🎵 ${r.artist_name} — ${r.track_name}`, 'green') }
    const onMusicActualizada = ({ id, status })  => setMusicRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    const onMusicEliminada   = ({ id })          => setMusicRequests(prev => prev.filter(r => r.id !== id))
    const onMusicCleared     = ()                => setMusicRequests(prev => prev.map(r => r.status === 'playing' ? { ...r, status: 'pending' } : r))

    setConnected(socket.connected)
    socket.on('connect',               onConnect)
    socket.on('disconnect',            onDisconnect)
    socket.on('estado_inicial',        onEstado)
    socket.on('nueva_foto',            onNueva)
    socket.on('foto_eliminada',        onEliminada)
    socket.on('mostrar_foto',          onMostrar)
    socket.on('slideshow_estado',      onSlideshow)
    socket.on('foto_actualizada',      onActualizada)
    socket.on('music_nueva',           onMusicNueva)
    socket.on('music_actualizada',     onMusicActualizada)
    socket.on('music_eliminada',       onMusicEliminada)
    socket.on('music_playing_cleared', onMusicCleared)

    return () => {
      socket.off('connect',               onConnect)
      socket.off('disconnect',            onDisconnect)
      socket.off('estado_inicial',        onEstado)
      socket.off('nueva_foto',            onNueva)
      socket.off('foto_eliminada',        onEliminada)
      socket.off('mostrar_foto',          onMostrar)
      socket.off('slideshow_estado',      onSlideshow)
      socket.off('foto_actualizada',      onActualizada)
      socket.off('music_nueva',           onMusicNueva)
      socket.off('music_actualizada',     onMusicActualizada)
      socket.off('music_eliminada',       onMusicEliminada)
      socket.off('music_playing_cleared', onMusicCleared)
    }
  }, [eventId])

  useEffect(() => {
    if (!eventId) return
    authFetch(`${BASE}api/e/${eventId}/photos`).then((r) => r.json()).then((ph) => setPhotos((prev) => (prev.length ? prev : ph)))
    authFetch(`${BASE}api/e/${eventId}/qr`).then((r) => r.json()).then(setQr)
    authFetch(`${BASE}api/e/${eventId}/music/requests`).then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setMusicRequests(data)
    })
    authFetch(`${BASE}api/e/${eventId}/music/qr`).then((r) => r.json()).then((d) => {
      if (d.qr) setMusicQr(d)
    })
  }, [eventId])

  // ── Photo actions ─────────────────────────────────────────────────────────
  const project      = (photo) => { socketRef.current?.emit('proyectar', { eventId, photo }); showToast('Foto proyectada') }
  const clearDisplay = () => { socketRef.current?.emit('proyectar', { eventId, photo: null }); setCurrentId(null); showToast('Pantalla apagada') }
  const deletePhoto  = (id) => { authFetch(`${BASE}api/e/${eventId}/photos/${id}`, { method: 'DELETE' }) }
  const toggleSlide  = (id) => {
    setPhotos((prev) => prev.map((p) => p.id === id ? { ...p, inSlideshow: !p.inSlideshow } : p))
    authFetch(`${BASE}api/e/${eventId}/photos/${id}/slideshow`, { method: 'PATCH' })
      .then((r) => {
        if (!r.ok) {
          setPhotos((prev) => prev.map((p) => p.id === id ? { ...p, inSlideshow: !p.inSlideshow } : p))
          showToast('Error al actualizar')
        }
      })
  }
  const clearAll = () => {
    Promise.all(photos.map((p) => authFetch(`${BASE}api/e/${eventId}/photos/${p.id}`, { method: 'DELETE' }))).then(() => showToast('Fotos eliminadas'))
  }
  const toggleSlideshow = () => {
    if (ssActive) socketRef.current?.emit('slideshow_stop', { eventId })
    else socketRef.current?.emit('slideshow_start', { eventId, interval: ssInterval * 1000 })
  }
  const changeInterval = (val) => { setSsInterval(val); if (ssActive) socketRef.current?.emit('slideshow_start', { eventId, interval: val * 1000 }) }

  // ── Music actions ─────────────────────────────────────────────────────────
  const deleteRequest = async (id) => {
    await authFetch(`${BASE}api/e/${eventId}/music/requests/${id}`, { method: 'DELETE' })
  }

  const currentPhoto = photos.find((p) => p.id === currentId) ?? null

  return (
    <div className={s.page}>
      <div className={s.topbar}>
        <img src={`${BASE}logo.png`} alt="Top DJ Group" className={s.logo} />
        <div className={s.spacer} />
        <div className={s.statChip}><div className={s.dot} /><span>Servidor activo</span></div>
        <div className={s.connBadge}>{connected ? 'conectado' : 'desconectado'}</div>
        <button className={s.btnLogout} onClick={logout} title="Cerrar sesión">⎋ Salir</button>
      </div>

      <div className={s.layout}>
        {/* ── Sidebar ── */}
        <aside className={s.sidebar}>
          <div className={s.sideSection}>
            <div className={s.sectionLabel}>QR para invitados</div>
            <div className={s.qrBlock}>
              {qr ? (<><img src={qr.qr} alt="QR" /><div className={s.qrUrl}>{qr.url}</div></>) : (<div className={s.qrLoading}>Cargando QR...</div>)}
            </div>
          </div>

          {musicEnabled && musicQr && (
            <div className={s.sideSection}>
              <div className={s.sectionLabel}>QR para música</div>
              <div className={s.qrBlock}>
                <img src={musicQr.qr} alt="QR Música" />
                <div className={s.qrUrl}>{musicQr.url}</div>
              </div>
            </div>
          )}

          <div className={s.sideSection}>
            <div className={s.sectionLabel}>Proyectando ahora</div>
            <div className={s.currentBlock}>
              {currentPhoto ? (<><img src={currentPhoto.url} alt="actual" /><div className={s.currentBadge}>EN VIVO</div></>) : (<div className={s.noImage}><span>📽️</span><span>Nada proyectado</span></div>)}
            </div>
            <button className={s.btnSs} onClick={clearDisplay}>⬛ Pantalla negra</button>
          </div>

          <div className={s.sideSection}>
            <div className={s.sectionLabel}>Slideshow automático</div>
            <div className={s.intervalRow}>
              {INTERVALS.map((sec) => (
                <button key={sec} className={`${s.intervalBtn} ${ssInterval === sec ? s.intervalSelected : ''}`} onClick={() => changeInterval(sec)}>
                  {sec}s
                </button>
              ))}
            </div>
            <button className={`${s.btnSs} ${ssActive ? s.btnSsActive : ''}`} onClick={toggleSlideshow}>
              {ssActive ? '⏸ Detener slideshow' : '▶ Iniciar slideshow'}
            </button>
          </div>
        </aside>

        {/* ── Main split ── */}
        <main className={s.main}>
          {/* ── Panel: Fotos ── */}
          <div className={`${s.panelPhotos} ${musicEnabled ? '' : s.panelFull}`}>
            <div className={s.panelHeader}>
              <div className={s.panelTitle}>📸 Fotos</div>
              <div className={s.photoCount}>{photos.length} foto{photos.length !== 1 ? 's' : ''}</div>
              <button className={s.btnClearAll} onClick={clearAll}>🗑 Borrar todas</button>
            </div>

            <div className={s.photoGrid}>
              {photos.length === 0 ? (
                <div className={s.emptyState}>
                  <div className={s.emptyIcon}>📭</div>
                  <p>Aún no hay fotos. Los invitados escanean el QR para empezar.</p>
                </div>
              ) : (
                photos.map((photo, i) => (
                  <div key={photo.id} className={`${s.photoCard} ${photo.id === currentId ? s.photoCardActive : ''} ${!photo.inSlideshow ? s.photoCardExcluded : ''}`}>
                    <img src={photo.url} loading="lazy" alt="foto" />
                    {i === 0 && photo._new && <div className={s.newBadge}>NUEVA</div>}
                    {photo.id === currentId && <div className={s.activeBadge}>✦ Activa</div>}
                    <button
                      className={`${s.btnSlide} ${photo.inSlideshow ? s.btnSlideOn : s.btnSlideOff}`}
                      onClick={(e) => { e.stopPropagation(); toggleSlide(photo.id) }}
                      title={photo.inSlideshow ? 'Quitar del slideshow' : 'Incluir en slideshow'}
                    >
                      {photo.inSlideshow ? '▶' : '⏸'}
                    </button>
                    <div className={s.photoOverlay}>
                      <div className={s.overlayActions}>
                        <button className={s.btnProject} onClick={() => project(photo)}>📽 Proyectar</button>
                        <button className={s.btnDelete} onClick={() => deletePhoto(photo.id)} title="Eliminar">🗑</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Panel: Música ── */}
          {musicEnabled && (
            <div className={s.panelMusic}>
              <div className={s.panelHeader}>
                <div className={s.panelTitle}>
                  🎵 Pedidos
                  {musicRequests.length > 0 && <span className={s.pendingBadge}>{musicRequests.length}</span>}
                </div>
              </div>

              {musicRequests.length === 0 ? (
                <div className={s.emptyState}>
                  <div className={s.emptyIcon}>🎵</div>
                  <p>Sin pedidos aún. Los invitados escanean el QR de música.</p>
                </div>
              ) : (
                <div className={s.musicList}>
                  {musicRequests.map((r) => (
                    <div key={r.id} className={s.musicCard}>
                      {r.album_art
                        ? <img src={r.album_art} alt="" className={s.musicCardArt} />
                        : <div className={s.musicCardArtPlaceholder}>🎵</div>
                      }
                      <div className={s.musicCardInfo}>
                        <div className={s.musicCardName}>{r.track_name}</div>
                        <div className={s.musicCardArtist}>{r.artist_name}</div>
                        {r.album_name && <div className={s.musicCardAlbum}>{r.album_name}</div>}
                      </div>
                      <div className={s.musicCardActions}>
                        <button className={`${s.musicBtn} ${s.musicBtnDel}`} onClick={() => deleteRequest(r.id)} title="Eliminar">🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <div className={`${s.toast} ${toast.visible ? s.toastShow : ''} ${toast.type === 'green' ? s.toastGreen : ''}`}>
        {toast.msg}
      </div>
    </div>
  )
}
