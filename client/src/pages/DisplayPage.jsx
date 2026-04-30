import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { getSocket } from '../lib/socket'
import s from './DisplayPage.module.css'

function MusicOverlay({ request }) {
  const [visible, setVisible] = useState(false)
  const prev = useRef(null)

  useEffect(() => {
    if (request) {
      setVisible(true)
      prev.current = request
    } else {
      setVisible(false)
    }
  }, [request?.id])

  const r = request || prev.current
  if (!r) return null

  return (
    <div className={`${s.musicOverlay} ${visible ? s.musicOverlayShow : ''}`}>
      {r.album_art && <img src={r.album_art} alt="" className={s.musicOverlayArt} />}
      <div className={s.musicOverlayText}>
        <div className={s.musicOverlayLabel}>Sonando ahora</div>
        <div className={s.musicOverlayName}>{r.track_name}</div>
        <div className={s.musicOverlayArtist}>{r.artist_name}</div>
      </div>
      <div className={s.eqBars}><span /><span /><span /><span /></div>
    </div>
  )
}

function useImageCrossfade() {
  const [urlA, setUrlA]         = useState('')
  const [urlB, setUrlB]         = useState('')
  const [activeSlot, setActive] = useState('A')
  const pendingSlot = useRef(null)

  const showImage = (url) => {
    if (!url) { setUrlA(''); setUrlB(''); setActive('A'); return }
    const incoming = activeSlot === 'A' ? 'B' : 'A'
    pendingSlot.current = incoming
    if (incoming === 'A') setUrlA(url)
    else setUrlB(url)
  }

  const onLoad = (slot) => {
    if (slot !== pendingSlot.current) return
    setActive(slot)
  }

  return { urlA, urlB, activeSlot, showImage, onLoad }
}

export default function DisplayPage() {
  const { eventId } = useParams()
  const { urlA, urlB, activeSlot, showImage, onLoad } = useImageCrossfade()
  const [hasPhoto, setHasPhoto]         = useState(false)
  const [currentVideo, setCurrentVideo] = useState(null)
  const [ssActive, setSsActive]         = useState(false)
  const [ssInterval, setSsInterval]     = useState(5000)
  const [ssProgress, setSsProgress]     = useState(0)
  const [videoProgress, setVideoProgress] = useState(0)
  const [photoShowTime, setPhotoShowTime] = useState(null)
  const [notif, setNotif]               = useState({ msg: '', visible: false })
  const [qrImg, setQrImg]               = useState(null)
  const [musicRequests, setMusicRequests] = useState([])
  const notifTimer  = useRef(null)
  const ssTimer     = useRef(null)
  const socketRef   = useRef(null)
  const videoRef    = useRef(null)

  useEffect(() => {
    if (!videoRef.current || !currentVideo) return
    videoRef.current.muted = true
    videoRef.current.play().catch(() => {})
  }, [currentVideo?.id])

  const playingTrack = musicRequests.find(r => r.status === 'playing') || null

  useEffect(() => {
    const BASE = import.meta.env.BASE_URL
    fetch(`${BASE}api/e/${eventId}/qr`)
      .then((r) => r.json())
      .then((data) => setQrImg(data.qr))
  }, [eventId])

  useEffect(() => {
    if (!eventId) return
    const socket = getSocket(eventId)
    socketRef.current = socket

    const onEstado    = ({ current, musicRequests: mr }) => {
      if (current) { showImage(current.url); setHasPhoto(true) }
      if (mr) setMusicRequests(mr)
    }
    const onMostrar      = (photo) => { if (!photo) { showImage(null); setHasPhoto(false); return }; setCurrentVideo(null); setVideoProgress(0); showImage(photo.url); setHasPhoto(true); setPhotoShowTime(Date.now()) }
    const onMostrarVideo = (video) => { if (!video) { setCurrentVideo(null); return }; showImage(null); setHasPhoto(false); setVideoProgress(0); setCurrentVideo(video) }
    const onNueva     = () => showNotif('📸 Nueva foto recibida')
    const onSlideshow = ({ active, interval }) => { setSsActive(active); if (active && interval) setSsInterval(interval) }

    const onMusicNueva       = (r)              => setMusicRequests(prev => [...prev, r])
    const onMusicActualizada = ({ id, status }) => setMusicRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    const onMusicEliminada   = ({ id })         => setMusicRequests(prev => prev.filter(r => r.id !== id))
    const onMusicCleared     = ()               => setMusicRequests(prev => prev.map(r => r.status === 'playing' ? { ...r, status: 'pending' } : r))

    socket.on('estado_inicial',        onEstado)
    socket.on('mostrar_foto',          onMostrar)
    socket.on('mostrar_video',         onMostrarVideo)
    socket.on('nueva_foto',            onNueva)
    socket.on('slideshow_estado',      onSlideshow)
    socket.on('music_nueva',           onMusicNueva)
    socket.on('music_actualizada',     onMusicActualizada)
    socket.on('music_eliminada',       onMusicEliminada)
    socket.on('music_playing_cleared', onMusicCleared)

    return () => {
      socket.off('estado_inicial',        onEstado)
      socket.off('mostrar_foto',          onMostrar)
      socket.off('mostrar_video',         onMostrarVideo)
      socket.off('nueva_foto',            onNueva)
      socket.off('slideshow_estado',      onSlideshow)
      socket.off('music_nueva',           onMusicNueva)
      socket.off('music_actualizada',     onMusicActualizada)
      socket.off('music_eliminada',       onMusicEliminada)
      socket.off('music_playing_cleared', onMusicCleared)
    }
  }, [eventId]) // eslint-disable-line

  useEffect(() => {
    clearInterval(ssTimer.current)
    if (!ssActive) { setSsProgress(0); return }
    setSsProgress(0)
    const start = photoShowTime || Date.now()
    ssTimer.current = setInterval(() => {
      setSsProgress(Math.min(((Date.now() - start) / ssInterval) * 100, 100))
    }, 50)
    return () => clearInterval(ssTimer.current)
  }, [ssActive, ssInterval, photoShowTime])

  const particles = Array.from({ length: 18 }, (_, i) => ({
    size:  3 + (i * 7) % 6,
    left:  (i * 37) % 100,
    dur:   8 + (i * 3) % 14,
    delay: -(i * 5) % 14,
    dx:    ((i % 5) - 2) * 30,
  }))

  const showNotif = (msg) => {
    clearTimeout(notifTimer.current)
    setNotif({ msg, visible: true })
    notifTimer.current = setTimeout(() => setNotif((n) => ({ ...n, visible: false })), 2500)
  }

  return (
    <div className={s.page} onClick={() => !document.fullscreenElement && document.documentElement.requestFullscreen?.()}>
      <div className={s.particles}>
        {particles.map((p, i) => (
          <div key={i} className={s.particle} style={{ width: p.size, height: p.size, left: `${p.left}%`, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`, '--dx': `${p.dx}px` }} />
        ))}
      </div>

      <div className={`${s.bgBlur} ${hasPhoto ? s.bgBlurShow : ''}`}
        style={{ backgroundImage: (urlA || urlB) ? `url('${activeSlot === 'A' ? urlA : urlB}')` : undefined }}
      />

      <div className={`${s.idleScreen} ${(hasPhoto || !!currentVideo) ? s.idleHidden : ''}`}>
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Top DJ Group" className={s.idleLogo} />
        <div className={s.idleSub}>Las fotos aparecerán aquí</div>
      </div>

      <div className={s.stage}>
        <div className={`${s.imgSlot} ${activeSlot === 'A' ? s.slotActive : ''}`}>
          {urlA && <img src={urlA} alt="" onLoad={() => onLoad('A')} />}
        </div>
        <div className={`${s.imgSlot} ${activeSlot === 'B' ? s.slotActive : ''}`}>
          {urlB && <img src={urlB} alt="" onLoad={() => onLoad('B')} />}
        </div>
      </div>

      {currentVideo && (
        <div className={s.videoStage}>
          <video
            ref={videoRef}
            key={currentVideo.id}
            src={currentVideo.url}
            playsInline
            onTimeUpdate={(e) => {
              const v = e.currentTarget
              if (v.duration) setVideoProgress((v.currentTime / v.duration) * 100)
            }}
            onEnded={() => { setVideoProgress(0); socketRef.current?.emit('video_slideshow_ended', { eventId }) }}
            className={s.videoPlayer}
          />
        </div>
      )}

      <div className={`${s.infoOverlay} ${(hasPhoto || !!currentVideo) ? s.infoShow : ''}`}>
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Top DJ Group" className={s.brandLogo} />
        <span className={s.igHandle}>@topdjgroup</span>
      </div>

      {qrImg && (
        <div className={s.qrCorner}>
          <img src={qrImg} alt="QR" className={s.qrImg} />
          <div className={s.qrTagline}>
            <span className={s.qrTaglineMain}>Subí tu foto</span>
            <span className={s.qrTaglineSep}>·</span>
            <span className={s.qrTaglineMain}>Pedí tu canción</span>
          </div>
        </div>
      )}

      {(ssActive || !!currentVideo) && (
        <div
          className={s.ssBar}
          style={{
            width: `${currentVideo ? videoProgress : ssProgress}%`,
            transition: currentVideo ? 'width 250ms linear' : undefined,
          }}
        />
      )}

      <MusicOverlay request={playingTrack} />

      <div className={`${s.notif} ${notif.visible ? s.notifShow : ''}`}>{notif.msg}</div>
    </div>
  )
}
