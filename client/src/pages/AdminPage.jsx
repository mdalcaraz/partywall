import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import socket from '../lib/socket'
import { authFetch } from '../lib/api'
import s from './AdminPage.module.css'

const INTERVALS = [3, 5, 10, 15]

export default function AdminPage() {
  const [photos, setPhotos]         = useState([])
  const [currentId, setCurrentId]   = useState(null)
  const [ssActive, setSsActive]     = useState(false)
  const [ssInterval, setSsInterval] = useState(3)
  const [qr, setQr]                 = useState(null)
  const [connected, setConnected]   = useState(socket.connected)
  const [toast, setToast]           = useState({ msg: '', type: '', visible: false })
  const toastTimer = useRef(null)
  const navigate   = useNavigate()

  const logout = () => {
    sessionStorage.removeItem('auth_token')
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    const onConnect    = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    const onEstado     = ({ current, photos: ph }) => { setPhotos(ph || []); setCurrentId(current?.id ?? null) }
    const onNueva      = (photo) => { setPhotos((prev) => [{ ...photo, _new: true }, ...prev]); showToast('📸 Nueva foto recibida', 'green') }
    const onEliminada  = ({ id }) => { setPhotos((prev) => prev.filter((p) => p.id !== id)); setCurrentId((cur) => (cur === id ? null : cur)) }
    const onMostrar    = (photo) => setCurrentId(photo?.id ?? null)
    const onSlideshow  = ({ active }) => setSsActive(active)
    const onActualizada = ({ id, inSlideshow }) => setPhotos((prev) => prev.map((p) => p.id === id ? { ...p, inSlideshow } : p))

    socket.on('connect',          onConnect)
    socket.on('disconnect',       onDisconnect)
    socket.on('estado_inicial',   onEstado)
    socket.on('nueva_foto',       onNueva)
    socket.on('foto_eliminada',   onEliminada)
    socket.on('mostrar_foto',     onMostrar)
    socket.on('slideshow_estado', onSlideshow)
    socket.on('foto_actualizada', onActualizada)

    return () => {
      socket.off('connect',          onConnect)
      socket.off('disconnect',       onDisconnect)
      socket.off('estado_inicial',   onEstado)
      socket.off('nueva_foto',       onNueva)
      socket.off('foto_eliminada',   onEliminada)
      socket.off('mostrar_foto',     onMostrar)
      socket.off('slideshow_estado', onSlideshow)
      socket.off('foto_actualizada', onActualizada)
    }
  }, [])

  useEffect(() => {
    authFetch(`${import.meta.env.BASE_URL}api/photos`).then((r) => r.json()).then((ph) => setPhotos((prev) => (prev.length ? prev : ph)))
    authFetch(`${import.meta.env.BASE_URL}api/qr`).then((r) => r.json()).then(setQr)
  }, [])

  const project = (photo) => { socket.emit('proyectar', photo); showToast('Foto proyectada') }
  const clearDisplay = () => { socket.emit('proyectar', null); setCurrentId(null); showToast('Pantalla apagada') }
  const deletePhoto  = (id) => { if (!confirm('¿Eliminar esta foto?')) return; authFetch(`${import.meta.env.BASE_URL}api/photos/${id}`, { method: 'DELETE' }) }
  const toggleSlide  = (id) => {
    // Optimistic update so the UI responds immediately
    setPhotos((prev) => prev.map((p) => p.id === id ? { ...p, inSlideshow: !p.inSlideshow } : p))
    authFetch(`${import.meta.env.BASE_URL}api/photos/${id}/slideshow`, { method: 'PATCH' })
      .then((r) => {
        if (!r.ok) {
          // Revert on failure
          setPhotos((prev) => prev.map((p) => p.id === id ? { ...p, inSlideshow: !p.inSlideshow } : p))
          showToast('Error al actualizar', '')
        }
      })
  }
  const clearAll     = () => {
    if (!confirm(`¿Eliminar las ${photos.length} fotos?`)) return
    Promise.all(photos.map((p) => authFetch(`${import.meta.env.BASE_URL}api/photos/${p.id}`, { method: 'DELETE' }))).then(() => showToast('Fotos eliminadas'))
  }
  const toggleSlideshow = () => {
    if (ssActive) socket.emit('slideshow_stop')
    else socket.emit('slideshow_start', { interval: ssInterval * 1000 })
  }
  const changeInterval = (val) => { setSsInterval(val); if (ssActive) socket.emit('slideshow_start', { interval: val * 1000 }) }
  const showToast = (msg, type = '') => {
    clearTimeout(toastTimer.current)
    setToast({ msg, type, visible: true })
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2500)
  }

  const currentPhoto = photos.find((p) => p.id === currentId) ?? null

  return (
    <div className={s.page}>
      <div className={s.topbar}>
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Top DJ Group" className={s.logo} />
        <div className={s.spacer} />
        <div className={s.statChip}><div className={s.dot} /><span>Servidor activo</span></div>
        <div className={s.connBadge}>{connected ? 'conectado' : 'desconectado'}</div>
        <button className={s.btnLogout} onClick={logout} title="Cerrar sesión">⎋ Salir</button>
      </div>

      <div className={s.layout}>
        <aside className={s.sidebar}>
          <div className={s.sideSection}>
            <div className={s.sectionLabel}>QR para invitados</div>
            <div className={s.qrBlock}>
              {qr ? (<><img src={qr.qr} alt="QR" /><div className={s.qrUrl}>{qr.url}</div></>) : (<div className={s.qrLoading}>Cargando QR...</div>)}
            </div>
          </div>

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

        <main className={s.main}>
          <div className={s.mainHeader}>
            <div className={s.mainTitle}>Fotos recibidas</div>
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
        </main>
      </div>

      <div className={`${s.toast} ${toast.visible ? s.toastShow : ''} ${toast.type === 'green' ? s.toastGreen : ''}`}>
        {toast.msg}
      </div>
    </div>
  )
}
