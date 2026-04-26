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
  const [panelMode, setPanelMode]   = useState('proyeccion') // 'proyeccion' | 'album'
  const [albumPhotos, setAlbumPhotos] = useState([])
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
    const onNueva      = (photo)          => {
      setPhotos((prev) => [{ ...photo, _new: true }, ...prev])
      setAlbumPhotos((prev) => [photo, ...prev])
      showToast('📸 Nueva foto recibida', 'green')
    }
    const onEliminada  = ({ id })         => {
      setPhotos((prev) => prev.filter((p) => p.id !== id))
      setAlbumPhotos((prev) => prev.filter((p) => p.id !== id))
      setCurrentId((cur) => (cur === id ? null : cur))
    }
    const onMostrar    = (photo)          => setCurrentId(photo?.id ?? null)
    const onSlideshow  = ({ active })     => setSsActive(active)
    const onActualizada = ({ id, inSlideshow }) => setPhotos((prev) => prev.map((p) => p.id === id ? { ...p, inSlideshow } : p))
    const onOcultada   = ({ id, hidden }) => {
      setPhotos((prev) => prev.map((p) => p.id === id ? { ...p, hidden } : p))
      setAlbumPhotos((prev) => prev.map((p) => p.id === id ? { ...p, hidden } : p))
    }

    // Music socket events
    const onMusicNueva       = (r)               => { setMusicRequests(prev => [...prev, r]); showToast(`🎵 ${r.artist_name} — ${r.track_name}`, 'green') }
    const onMusicActualizada = ({ id, status })  => setMusicRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    const onMusicEliminada   = ({ id })          => setMusicRequests(prev => prev.filter(r => r.id !== id))
    const onMusicCleared     = ()                => setMusicRequests(prev => prev.map(r => r.status === 'playing' ? { ...r, status: 'pending' } : r))
    const onMusicVote        = ({ id, votes })   => setMusicRequests(prev => prev.map(r => r.id === id ? { ...r, votes } : r))

    setConnected(socket.connected)
    socket.on('connect',               onConnect)
    socket.on('disconnect',            onDisconnect)
    socket.on('estado_inicial',        onEstado)
    socket.on('nueva_foto',            onNueva)
    socket.on('foto_eliminada',        onEliminada)
    socket.on('mostrar_foto',          onMostrar)
    socket.on('slideshow_estado',      onSlideshow)
    socket.on('foto_actualizada',      onActualizada)
    socket.on('foto_ocultada',         onOcultada)
    socket.on('music_nueva',           onMusicNueva)
    socket.on('music_actualizada',     onMusicActualizada)
    socket.on('music_eliminada',       onMusicEliminada)
    socket.on('music_playing_cleared', onMusicCleared)
    socket.on('music_vote',            onMusicVote)

    return () => {
      socket.off('connect',               onConnect)
      socket.off('disconnect',            onDisconnect)
      socket.off('estado_inicial',        onEstado)
      socket.off('nueva_foto',            onNueva)
      socket.off('foto_eliminada',        onEliminada)
      socket.off('mostrar_foto',          onMostrar)
      socket.off('slideshow_estado',      onSlideshow)
      socket.off('foto_actualizada',      onActualizada)
      socket.off('foto_ocultada',         onOcultada)
      socket.off('music_nueva',           onMusicNueva)
      socket.off('music_actualizada',     onMusicActualizada)
      socket.off('music_eliminada',       onMusicEliminada)
      socket.off('music_playing_cleared', onMusicCleared)
      socket.off('music_vote',            onMusicVote)
    }
  }, [eventId])

  useEffect(() => {
    if (!eventId) return
    authFetch(`${BASE}api/e/${eventId}/photos`).then((r) => r.json()).then((ph) => setPhotos((prev) => (prev.length ? prev : ph)))
    authFetch(`${BASE}api/e/${eventId}/photos/all`).then((r) => r.json()).then((ph) => { if (Array.isArray(ph)) setAlbumPhotos(ph) })
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

  const hidePhoto = (id) => {
    setAlbumPhotos((prev) => prev.map((p) => p.id === id ? { ...p, hidden: !p.hidden } : p))
    authFetch(`${BASE}api/e/${eventId}/photos/${id}/hide`, { method: 'PATCH' })
      .then((r) => { if (!r.ok) setAlbumPhotos((prev) => prev.map((p) => p.id === id ? { ...p, hidden: !p.hidden } : p)) })
  }

  // ── Music actions ─────────────────────────────────────────────────────────
  const deleteRequest = async (id) => {
    await authFetch(`${BASE}api/e/${eventId}/music/requests/${id}`, { method: 'DELETE' })
  }

  const currentPhoto = photos.find((p) => p.id === currentId) ?? null
  const playlist     = photos.filter((p) => p.inSlideshow)

  return (
    <div className={s.page}>
      <div className={s.topbar}>
        <img src={`${BASE}logo.png`} alt="Top DJ Group" className={s.logo} />
        <div className={s.panelTabs}>
          <button className={`${s.panelTab} ${panelMode === 'proyeccion' ? s.panelTabActive : ''}`} onClick={() => setPanelMode('proyeccion')}>
            📽 Proyección
          </button>
          <button className={`${s.panelTab} ${panelMode === 'album' ? s.panelTabActive : ''}`} onClick={() => setPanelMode('album')}>
            🖼 Álbum
            {albumPhotos.length > 0 && <span className={s.albumTabCount}>{albumPhotos.length}</span>}
          </button>
        </div>
        <div className={s.spacer} />
        <a
          href={`${BASE}e/${eventId}/album`}
          target="_blank"
          rel="noreferrer"
          className={s.btnAlbumLink}
          title="Ver álbum público"
        >
          🖼 Ver álbum ↗
        </a>
        <div className={s.statChip}><div className={s.dot} /><span>Servidor activo</span></div>
        <div className={s.connBadge}>{connected ? 'conectado' : 'desconectado'}</div>
        <button className={s.btnLogout} onClick={logout} title="Cerrar sesión">⎋ Salir</button>
      </div>

      {/* ── Album panel ── */}
      {panelMode === 'album' && (
        <div className={s.albumPanel}>
          <div className={s.albumPanelHeader}>
            <div className={s.panelTitle}>🖼 Álbum del evento</div>
            <span className={s.albumSubtitle}>
              Las fotos ocultas no aparecen en proyección pero sí en el álbum público. Eliminadas desaparecen de todo.
            </span>
          </div>
          {albumPhotos.length === 0 ? (
            <div className={s.emptyState}>
              <div className={s.emptyIcon}>📭</div>
              <p>No hay fotos en el álbum todavía.</p>
            </div>
          ) : (
            <div className={s.albumGrid}>
              {albumPhotos.map((photo) => (
                <div key={photo.id} className={`${s.albumCard} ${photo.hidden ? s.albumCardHidden : ''}`}>
                  <img src={photo.url} loading="lazy" alt="" />
                  {photo.hidden && <div className={s.hiddenBadge}>Oculta</div>}
                  <div className={s.albumOverlay}>
                    <div className={s.albumOverlayActions}>
                      <button
                        className={`${s.btnAlbumHide} ${photo.hidden ? s.btnAlbumHideActive : ''}`}
                        onClick={() => hidePhoto(photo.id)}
                        title={photo.hidden ? 'Mostrar en proyección' : 'Ocultar de proyección'}
                      >
                        {photo.hidden ? '👁 Mostrar' : '🚫 Ocultar'}
                      </button>
                      <button className={s.btnAlbumDelete} onClick={() => deletePhoto(photo.id)} title="Eliminar definitivamente">
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={`${s.layout} ${panelMode !== 'proyeccion' ? s.layoutHidden : ''}`}>
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
            <div className={s.sectionLabel}>Modo de reproducción</div>
            <div className={s.modeToggle}>
              <button className={`${s.modeBtn} ${!ssActive ? s.modeBtnActive : ''}`} onClick={() => { if (ssActive) toggleSlideshow() }}>
                Manual
              </button>
              <button className={`${s.modeBtn} ${ssActive ? s.modeBtnActive : ''}`} onClick={() => { if (!ssActive) toggleSlideshow() }}>
                ▶ Lista
              </button>
            </div>
            <div className={s.intervalRow}>
              {INTERVALS.map((sec) => (
                <button key={sec} className={`${s.intervalBtn} ${ssInterval === sec ? s.intervalSelected : ''}`} onClick={() => changeInterval(sec)}>
                  {sec}s
                </button>
              ))}
            </div>
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

            {/* ── Playlist strip ── */}
            <div className={s.playlistSection}>
              <div className={s.playlistHeader}>
                <span className={s.playlistLabel}>Lista de reproducción</span>
                <span className={s.playlistCount}>{playlist.length} foto{playlist.length !== 1 ? 's' : ''}</span>
              </div>
              {playlist.length === 0 ? (
                <div className={s.playlistEmpty}>Vacía · Usá "+ Lista" en cada foto para agregarla</div>
              ) : (
                <div className={s.playlistStrip}>
                  {playlist.map((photo) => (
                    <div key={photo.id} className={`${s.playlistItem} ${photo.id === currentId ? s.playlistItemActive : ''}`}>
                      <img src={photo.url} alt="" className={s.playlistThumb} />
                      <button className={s.btnRemoveFromList} onClick={() => toggleSlide(photo.id)} title="Quitar de lista">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Photo grid ── */}
            <div className={s.photoGrid}>
              {photos.length === 0 ? (
                <div className={s.emptyState}>
                  <div className={s.emptyIcon}>📭</div>
                  <p>Aún no hay fotos. Los invitados escanean el QR para empezar.</p>
                </div>
              ) : (
                photos.map((photo, i) => (
                  <div key={photo.id} className={`${s.photoCard} ${photo.id === currentId ? s.photoCardActive : ''}`}>
                    <img src={photo.url} loading="lazy" alt="foto" />
                    {i === 0 && photo._new && <div className={s.newBadge}>NUEVA</div>}
                    {photo.id === currentId && <div className={s.activeBadge}>✦ Activa</div>}
                    {photo.inSlideshow && <div className={s.inListBadge}>✓ Lista</div>}
                    <div className={s.photoOverlay}>
                      <div className={s.overlayActions}>
                        <button className={s.btnProject} onClick={() => project(photo)}>📽 Proyectar</button>
                        <button
                          className={`${s.btnAddList} ${photo.inSlideshow ? s.btnAddListActive : ''}`}
                          onClick={(e) => { e.stopPropagation(); toggleSlide(photo.id) }}
                        >
                          {photo.inSlideshow ? '✓' : '+ Lista'}
                        </button>
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
                      {r.votes > 0 && <div className={s.musicVoteBadge}>🔥 {r.votes}</div>}
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
