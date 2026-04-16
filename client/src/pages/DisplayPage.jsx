import { useState, useEffect, useRef } from 'react'
import socket from '../lib/socket'
import s from './DisplayPage.module.css'

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
  const { urlA, urlB, activeSlot, showImage, onLoad } = useImageCrossfade()
  const [hasPhoto, setHasPhoto]     = useState(false)
  const [ssActive, setSsActive]     = useState(false)
  const [ssInterval, setSsInterval] = useState(5000)
  const [ssProgress, setSsProgress] = useState(0)
  const [notif, setNotif]           = useState({ msg: '', visible: false })
  const [qrImg, setQrImg]           = useState(null)
  const notifTimer = useRef(null)
  const ssTimer    = useRef(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/qr`)
      .then((r) => r.json())
      .then((data) => setQrImg(data.qr))
  }, [])

  useEffect(() => {
    const onEstado    = ({ current }) => { if (current) { showImage(current.url); setHasPhoto(true) } }
    const onMostrar   = (photo) => { if (!photo) { showImage(null); setHasPhoto(false); return }; showImage(photo.url); setHasPhoto(true) }
    const onNueva     = () => showNotif('📸 Nueva foto recibida')
    const onSlideshow = ({ active, interval }) => { setSsActive(active); if (active && interval) setSsInterval(interval) }

    socket.on('estado_inicial',   onEstado)
    socket.on('mostrar_foto',     onMostrar)
    socket.on('nueva_foto',       onNueva)
    socket.on('slideshow_estado', onSlideshow)

    return () => {
      socket.off('estado_inicial',   onEstado)
      socket.off('mostrar_foto',     onMostrar)
      socket.off('nueva_foto',       onNueva)
      socket.off('slideshow_estado', onSlideshow)
    }
  }, []) // eslint-disable-line

  useEffect(() => {
    clearInterval(ssTimer.current)
    if (!ssActive) { setSsProgress(0); return }
    setSsProgress(0)
    const start = Date.now()
    ssTimer.current = setInterval(() => {
      setSsProgress(Math.min(((Date.now() - start) / ssInterval) * 100, 100))
    }, 50)
    return () => clearInterval(ssTimer.current)
  }, [ssActive, ssInterval])

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

      <div className={`${s.idleScreen} ${hasPhoto ? s.idleHidden : ''}`}>
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

      <div className={`${s.infoOverlay} ${hasPhoto ? s.infoShow : ''}`}>
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Top DJ Group" className={s.brandLogo} />
        <span className={s.igHandle}>@topdjgroup</span>
      </div>

      {/* QR permanente — abajo a la derecha */}
      {qrImg && (
        <div className={s.qrCorner}>
          <div className={s.qrLabel}>Escaneá para enviar tu foto</div>
          <img src={qrImg} alt="QR" className={s.qrImg} />
        </div>
      )}

      {ssActive && <div className={s.ssBar} style={{ width: `${ssProgress}%` }} />}

      <div className={`${s.notif} ${notif.visible ? s.notifShow : ''}`}>{notif.msg}</div>
    </div>
  )
}
