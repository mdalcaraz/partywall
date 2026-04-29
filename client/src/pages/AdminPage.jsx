import { useState, useEffect, useRef, Fragment } from 'react'
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
  const [photos, setPhotos]             = useState([])
  const [currentId, setCurrentId]       = useState(null)
  const [currentVideoProj, setCurrentVideoProj] = useState(null)
  const [ssActive, setSsActive]     = useState(false)
  const [ssInterval, setSsInterval] = useState(3)
  const [qr, setQr]                 = useState(null)
  const [connected, setConnected]   = useState(false)
  const [toast, setToast]           = useState({ msg: '', type: '', visible: false })
  const [panelMode, setPanelMode]   = useState('proyeccion') // 'proyeccion' | 'album'
  const [albumPhotos, setAlbumPhotos] = useState([])
  const [albumVideos, setAlbumVideos] = useState([])
  const [mediaModal, setMediaModal]   = useState(null) // null | item con _type
  const [showQrs, setShowQrs]       = useState(false)
  const toastTimer    = useRef(null)
  const socketRef     = useRef(null)
  const currentVidRef = useRef(null)

  useEffect(() => {
    if (!currentVidRef.current || !currentVideoProj) return
    currentVidRef.current.muted = true
    currentVidRef.current.play().catch(() => {})
  }, [currentVideoProj?.id])

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
    const onEstado     = ({ current, photos: ph, videos: vids, musicRequests: mr, musicEnabled: me }) => {
      setPhotos(ph || [])
      setCurrentId(current?.id ?? null)
      if (Array.isArray(vids)) setAlbumVideos(vids)
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
    const onMostrar      = (photo) => { setCurrentId(photo?.id ?? null); if (photo) setCurrentVideoProj(null) }
    const onMostrarVideo = (video) => { setCurrentVideoProj(video || null); if (video) setCurrentId(null) }
    const onSlideshow  = ({ active })     => setSsActive(active)
    const onActualizada = ({ id, inSlideshow }) => setPhotos((prev) => prev.map((p) => p.id === id ? { ...p, inSlideshow } : p))
    const onOcultada   = ({ id, hidden }) => {
      setPhotos((prev) => prev.map((p) => p.id === id ? { ...p, hidden } : p))
      setAlbumPhotos((prev) => prev.map((p) => p.id === id ? { ...p, hidden } : p))
    }

    // Video socket events
    const onVideoNueva      = (video) => { setAlbumVideos(prev => [video, ...prev]); showToast('🎬 Nuevo video recibido', 'green') }
    const onVideoLista      = (video) => setAlbumVideos(prev => prev.map(v => v.id === video.id ? video : v))
    const onVideoActualizada = ({ id, inSlideshow }) => setAlbumVideos(prev => prev.map(v => v.id === id ? { ...v, inSlideshow } : v))
    const onVideoElim  = ({ id }) => {
      setAlbumVideos(prev => prev.filter(v => v.id !== id))
      setMediaModal(m => m?.id === id ? null : m)
    }
    const onVideoError = ({ id }) => {
      setAlbumVideos(prev => prev.map(v => v.id === id ? { ...v, status: 'error' } : v))
      showToast('❌ Error al procesar video', 'red')
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
    socket.on('mostrar_video',         onMostrarVideo)
    socket.on('slideshow_estado',      onSlideshow)
    socket.on('foto_actualizada',      onActualizada)
    socket.on('foto_ocultada',         onOcultada)
    socket.on('video_nueva',           onVideoNueva)
    socket.on('video_lista',           onVideoLista)
    socket.on('video_eliminada',       onVideoElim)
    socket.on('video_error',           onVideoError)
    socket.on('video_actualizada',     onVideoActualizada)
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
      socket.off('mostrar_video',         onMostrarVideo)
      socket.off('slideshow_estado',      onSlideshow)
      socket.off('foto_actualizada',      onActualizada)
      socket.off('foto_ocultada',         onOcultada)
      socket.off('video_nueva',           onVideoNueva)
      socket.off('video_lista',           onVideoLista)
      socket.off('video_eliminada',       onVideoElim)
      socket.off('video_error',           onVideoError)
      socket.off('video_actualizada',     onVideoActualizada)
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
    authFetch(`${BASE}api/e/${eventId}/videos/all`).then((r) => r.json()).then((vids) => { if (Array.isArray(vids)) setAlbumVideos(vids) })
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
  const clearDisplay = () => { socketRef.current?.emit('proyectar', { eventId, photo: null }); setCurrentId(null); setCurrentVideoProj(null); showToast('Pantalla apagada') }
  const deletePhoto  = (id) => { authFetch(`${BASE}api/e/${eventId}/photos/${id}`, { method: 'DELETE' }) }
  const toggleSlide  = (id) => {
    setPhotos((prev) => prev.map((p) => p.id === id ? { ...p, inSlideshow: !p.inSlideshow } : p))
    authFetch(`${BASE}api/e/${eventId}/photos/${id}/slideshow`, { method: 'PATCH' })
      .then((r) => { if (!r.ok) setPhotos((prev) => prev.map((p) => p.id === id ? { ...p, inSlideshow: !p.inSlideshow } : p)) })
  }
  const toggleVideoSlide = (id) => {
    setAlbumVideos((prev) => prev.map((v) => v.id === id ? { ...v, inSlideshow: !v.inSlideshow } : v))
    authFetch(`${BASE}api/e/${eventId}/videos/${id}/slideshow`, { method: 'PATCH' })
      .then((r) => { if (!r.ok) setAlbumVideos((prev) => prev.map((v) => v.id === id ? { ...v, inSlideshow: !v.inSlideshow } : v)) })
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

  // ── Video actions ─────────────────────────────────────────────────────────
  const projectVideo = (video) => {
    socketRef.current?.emit('proyectar_video', { eventId, video })
    setMediaModal(null)
  showToast('🎬 Video proyectado')
  }
  const hideVideo = (id) => {
    setAlbumVideos((prev) => prev.map((v) => v.id === id ? { ...v, hidden: !v.hidden } : v))
    authFetch(`${BASE}api/e/${eventId}/videos/${id}/hide`, { method: 'PATCH' })
      .then((r) => { if (!r.ok) setAlbumVideos((prev) => prev.map((v) => v.id === id ? { ...v, hidden: !v.hidden } : v)) })
  }
  const deleteVideo = (id) => {
    authFetch(`${BASE}api/e/${eventId}/videos/${id}`, { method: 'DELETE' })
    setMediaModal((m) => (m?.id === id ? null : m))
  }

  // ── Music actions ─────────────────────────────────────────────────────────
  const deleteRequest = async (id) => {
    await authFetch(`${BASE}api/e/${eventId}/music/requests/${id}`, { method: 'DELETE' })
  }

  const currentPhoto = photos.find((p) => p.id === currentId) ?? null
  const allMedia = [
    ...photos.map(p => ({ ...p, _type: 'photo' })),
    ...albumVideos.filter(v => v.status === 'ready').map(v => ({ ...v, _type: 'video' })),
  ].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
  const playlist = allMedia.filter(m => m.inSlideshow)
  const totalAlbum = albumPhotos.length + albumVideos.length

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
            {totalAlbum > 0 && <span className={s.albumTabCount}>{totalAlbum}</span>}
          </button>
        </div>
        <div className={s.spacer} />
        <a
          href={`${BASE}e/${eventId}`}
          target="_blank"
          rel="noreferrer"
          className={s.btnAlbumLink}
          title="Hub de invitados"
        >
          🔗 Hub ↗
        </a>
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
              Ocultas: no aparecen en proyección pero sí en el álbum público. Eliminadas: desaparecen de todo.
            </span>
          </div>

          {totalAlbum === 0 ? (
            <div className={s.emptyState}>
              <div className={s.emptyIcon}>📭</div>
              <p>No hay contenido en el álbum todavía.</p>
            </div>
          ) : (
            <>
              {/* Photos */}
              {albumPhotos.length > 0 && (
                <>
                  {albumVideos.length > 0 && (
                    <div className={s.albumSectionLabel}>📸 Fotos · {albumPhotos.length}</div>
                  )}
                  <div className={s.albumGrid}>
                    {albumPhotos.map((photo) => (
                      <div key={photo.id} className={`${s.albumCard} ${photo.hidden ? s.albumCardHidden : ''}`} onClick={() => setMediaModal({ ...photo, _type: 'photo' })}>
                        <img src={photo.url} loading="lazy" alt="" />
                        {photo.hidden && <div className={s.hiddenBadge}>Oculta</div>}
                        <div className={s.albumOverlay}>
                          <div className={s.albumOverlayActions}>
                            <button
                              className={`${s.btnAlbumHide} ${photo.hidden ? s.btnAlbumHideActive : ''}`}
                              onClick={(e) => { e.stopPropagation(); hidePhoto(photo.id) }}
                            >
                              {photo.hidden ? '👁 Mostrar' : '🚫 Ocultar'}
                            </button>
                            <button className={s.btnAlbumDelete} onClick={(e) => { e.stopPropagation(); deletePhoto(photo.id) }}>🗑</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Videos */}
              {albumVideos.length > 0 && (
                <>
                  <div className={s.albumSectionLabel}>🎬 Videos · {albumVideos.length}</div>
                  <div className={s.albumGrid}>
                    {albumVideos.map((video) => (
                      <div
                        key={video.id}
                        className={`${s.albumCard} ${video.status === 'ready' ? s.videoAlbumCard : ''} ${video.hidden ? s.albumCardHidden : ''}`}
                        onClick={() => video.status === 'ready' && setMediaModal({ ...video, _type: 'video' })}
                      >
                        {video.thumbnail_url
                          ? <img src={video.thumbnail_url} loading="lazy" alt="" />
                          : <div className={s.videoThumbPlaceholder}>🎬</div>
                        }
                        {video.status === 'processing' && <div className={s.videoProcBadge}>Procesando...</div>}
                        {video.status === 'ready' && <div className={s.videoPlayIcon}>▶</div>}
                        {video.status === 'error' && <div className={s.videoErrBadge}>❌ Error</div>}
                        {video.hidden && <div className={s.hiddenBadge}>Oculto</div>}
                        <div className={s.albumOverlay}>
                          <div className={s.albumOverlayActions}>
                            <button
                              className={`${s.btnAlbumHide} ${video.hidden ? s.btnAlbumHideActive : ''}`}
                              onClick={(e) => { e.stopPropagation(); hideVideo(video.id) }}
                            >
                              {video.hidden ? '👁 Mostrar' : '🚫 Ocultar'}
                            </button>
                            <button
                              className={s.btnAlbumDelete}
                              onClick={(e) => { e.stopPropagation(); deleteVideo(video.id) }}
                            >
                              🗑
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Media preview modal (fotos + videos) ── */}
      {mediaModal && (
        <div className={s.videoModal} onClick={() => setMediaModal(null)}>
          <div className={s.videoModalInner} onClick={(e) => e.stopPropagation()}>
            {mediaModal._type === 'video'
              ? <video key={mediaModal.id} src={mediaModal.url} controls autoPlay muted playsInline className={s.videoModalPlayer} />
              : <img src={mediaModal.url} className={s.photoModalImg} alt="" />
            }
            <div className={s.videoModalActions}>
              <button className={s.btnProjectVideo} onClick={() => { mediaModal._type === 'video' ? projectVideo(mediaModal) : project(mediaModal); setMediaModal(null) }}>
                📽 Proyectar
              </button>
              <button
                className={`${s.btnAlbumHide} ${mediaModal.inSlideshow ? s.btnAddListActive : ''}`}
                onClick={() => {
                  mediaModal._type === 'video' ? toggleVideoSlide(mediaModal.id) : toggleSlide(mediaModal.id)
                  setMediaModal(m => ({ ...m, inSlideshow: !m.inSlideshow }))
                }}
              >
                {mediaModal.inSlideshow ? '✓ En lista' : '+ Lista'}
              </button>
              {mediaModal._type === 'video'
                ? <button className={s.btnVideoDelete} onClick={() => { deleteVideo(mediaModal.id); setMediaModal(null) }}>🗑 Eliminar</button>
                : <button className={s.btnVideoDelete} onClick={() => { deletePhoto(mediaModal.id); setMediaModal(null) }}>🗑 Eliminar</button>
              }
              <button className={s.btnModalClose} onClick={() => setMediaModal(null)}>✕</button>
            </div>
          </div>
        </div>
      )}

      <div className={`${s.layout} ${panelMode !== 'proyeccion' ? s.layoutHidden : ''}`}>
        {/* ── Sidebar ── */}
        <aside className={s.sidebar}>
          <div className={s.sideSection}>
            <button className={s.qrToggle} onClick={() => setShowQrs(v => !v)}>
              <span className={s.sectionLabel} style={{ pointerEvents: 'none' }}>Códigos QR</span>
              <span className={s.qrToggleIcon}>{showQrs ? '▲' : '▼'}</span>
            </button>
            {showQrs && (
              <div className={s.qrRow}>
                <div className={s.qrBlock}>
                  <div className={s.qrLabel}>Fotos</div>
                  {qr ? (<><img src={qr.qr} alt="QR" /><div className={s.qrUrl}>{qr.url}</div></>) : (<div className={s.qrLoading}>Cargando...</div>)}
                </div>
                {musicEnabled && musicQr && (
                  <div className={s.qrBlock}>
                    <div className={s.qrLabel}>Música</div>
                    <img src={musicQr.qr} alt="QR Música" />
                    <div className={s.qrUrl}>{musicQr.url}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={s.sideSection}>
            <div className={s.sectionLabel}>Proyectando ahora</div>
            <div className={s.currentBlock}>
              {currentVideoProj ? (
                <>
                  <video
                    ref={currentVidRef}
                    key={currentVideoProj.id}
                    src={currentVideoProj.url}
                    playsInline
                    loop
                    className={s.currentVideoPreview}
                  />
                  <div className={s.currentBadge}>EN VIVO</div>
                </>
              ) : currentPhoto ? (
                <><img src={currentPhoto.url} alt="actual" /><div className={s.currentBadge}>EN VIVO</div></>
              ) : (
                <div className={s.noImage}><span>📽️</span><span>Nada proyectado</span></div>
              )}
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
              <div className={s.panelTitle}>📸 Media</div>
              <div className={s.photoCount}>{allMedia.length} elemento{allMedia.length !== 1 ? 's' : ''}</div>
              <button className={s.btnClearAll} onClick={clearAll}>🗑 Borrar fotos</button>
            </div>

            {/* ── Playlist strip ── */}
            <div className={s.playlistSection}>
              <div className={s.playlistHeader}>
                <span className={s.playlistLabel}>Lista de reproducción</span>
                <span className={s.playlistCount}>{playlist.length} elemento{playlist.length !== 1 ? 's' : ''}</span>
              </div>
              {playlist.length === 0 ? (
                <div className={s.playlistEmpty}>Vacía · Usá "+ Lista" en cada elemento para agregarlo</div>
              ) : (
                <div className={s.playlistStrip}>
                  {playlist.map((item) => (
                    <div key={item.id} className={`${s.playlistItem} ${item.id === currentId ? s.playlistItemActive : ''}`}>
                      {item._type === 'video'
                        ? <div className={s.playlistVideoThumb}>{item.thumbnail_url ? <img src={item.thumbnail_url} alt="" className={s.playlistThumb} /> : '🎬'}<span className={s.playlistVideoBadge}>▶</span></div>
                        : <img src={item.url} alt="" className={s.playlistThumb} />
                      }
                      <button className={s.btnRemoveFromList} onClick={() => item._type === 'video' ? toggleVideoSlide(item.id) : toggleSlide(item.id)} title="Quitar de lista">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Media grid unificada ── */}
            <div className={s.photoGrid}>
              {allMedia.length === 0 ? (
                <div className={s.emptyState}>
                  <div className={s.emptyIcon}>📭</div>
                  <p>Aún no hay fotos ni videos. Los invitados escanean el QR para empezar.</p>
                </div>
              ) : (() => {
                const groupsMap = {}
                const groupsOrder = []
                allMedia.forEach(item => {
                  const d = item.timestamp ? new Date(item.timestamp) : null
                  const key = d
                    ? `${d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })} · ${d.getHours()}:00`
                    : 'Sin fecha'
                  if (!groupsMap[key]) { groupsMap[key] = []; groupsOrder.push(key) }
                  groupsMap[key].push(item)
                })
                return groupsOrder.map((key) => (
                  <Fragment key={key}>
                    <div className={s.mediaGroupLabel}>{key}</div>
                    {groupsMap[key].map((item) => (
                      <div
                        key={item.id}
                        className={`${s.photoCard} ${item._type === 'video' ? s.photoCardVideo : ''} ${item.id === currentId ? s.photoCardActive : ''}`}
                        onClick={() => setMediaModal(item)}
                      >
                        {item._type === 'video'
                          ? <>{item.thumbnail_url ? <img src={item.thumbnail_url} loading="lazy" alt="" /> : <div className={s.videoThumbPlaceholder}>🎬</div>}<div className={s.videoPlayIcon}>▶</div></>
                          : <img src={item.url} loading="lazy" alt="foto" />
                        }
                        {item._new && <div className={s.newBadge}>NUEVA</div>}
                        {item.id === currentId && <div className={s.activeBadge}>✦ Activa</div>}
                        {item.inSlideshow && <div className={s.inListBadge}>✓ Lista</div>}
                        <div className={s.photoOverlay}>
                          <div className={s.overlayActions}>
                            <button
                              className={s.btnProject}
                              onClick={(e) => { e.stopPropagation(); item._type === 'video' ? projectVideo(item) : project(item) }}
                            >
                              📽 Proyectar
                            </button>
                            <button
                              className={`${s.btnAddList} ${item.inSlideshow ? s.btnAddListActive : ''}`}
                              onClick={(e) => { e.stopPropagation(); item._type === 'video' ? toggleVideoSlide(item.id) : toggleSlide(item.id) }}
                            >
                              {item.inSlideshow ? '✓ Lista' : '+ Lista'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </Fragment>
                ))
              })()}
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
