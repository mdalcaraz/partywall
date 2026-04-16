import { useState, useRef, useEffect, useCallback } from 'react'
import s from './GuestPage.module.css'

const TIMER_OPTIONS = [0, 3, 5]

function launchConfetti() {
  const colors = ['#c8a042', '#e8bf5a', '#f5f2ec', '#a07830', '#fff8e0']
  for (let i = 0; i < 16; i++) {
    const dot = document.createElement('div')
    dot.style.cssText = `
      position:fixed;
      width:8px; height:8px;
      border-radius:50%;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      left:${30 + Math.random() * 40}%;
      top:72%;
      pointer-events:none;
      animation: confetti-float ${0.7 + Math.random() * 0.5}s ease-out ${Math.random() * 0.3}s forwards;
      z-index:9999;
    `
    document.body.appendChild(dot)
    dot.addEventListener('animationend', () => dot.remove())
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export default function GuestPage() {
  const videoRef  = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  const [mode, setMode]               = useState('camera')
  const [facingMode, setFacingMode]   = useState('user')
  const [timerIdx, setTimerIdx]       = useState(0)
  const [sentCount, setSentCount]     = useState(0)
  const [status, setStatus]           = useState({ text: 'Enfocá y presioná el botón', type: '' })
  const [capturedBlob, setCapturedBlob] = useState(null)
  const [previewUrl, setPreviewUrl]   = useState(null)
  const [timerCount, setTimerCount]   = useState(null)
  const [showFlash, setShowFlash]     = useState(false)
  const [cameraError, setCameraError] = useState(false)

  const timerDelay = TIMER_OPTIONS[timerIdx]

  const startCamera = useCallback(async (facing) => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraError(false)
    } catch {
      setCameraError(true)
      setStatus({ text: 'Sin acceso a la cámara', type: 'err' })
    }
  }, [])

  useEffect(() => {
    startCamera('user')
    return () => streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [startCamera])

  const flipCamera = async () => {
    const next = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(next)
    await startCamera(next)
  }

  const toggleTimer = () => setTimerIdx((i) => (i + 1) % TIMER_OPTIONS.length)

  const capture = async () => {
    if (timerDelay > 0) {
      for (let i = timerDelay; i >= 1; i--) {
        setTimerCount(i)
        await wait(1000)
      }
      setTimerCount(null)
    }
    setShowFlash(true)
    setTimeout(() => setShowFlash(false), 120)

    const video  = videoRef.current
    const canvas = canvasRef.current
    canvas.width  = video.videoWidth  || 1280
    canvas.height = video.videoHeight || 960
    const ctx = canvas.getContext('2d')
    if (facingMode === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1) }
    ctx.drawImage(video, 0, 0)

    canvas.toBlob((blob) => {
      setCapturedBlob(blob)
      setPreviewUrl(URL.createObjectURL(blob))
      setMode('preview')
      setStatus({ text: '¿Te gustó? Enviala ✨', type: '' })
    }, 'image/jpeg', 0.88)
  }

  const sendPhoto = async () => {
    if (!capturedBlob) return
    setMode('sending')
    setStatus({ text: 'Enviando...', type: 'sending' })
    const fd = new FormData()
    fd.append('photo', capturedBlob, `foto_${Date.now()}.jpg`)
    try {
      const res  = await fetch(`${import.meta.env.BASE_URL}api/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setSentCount((c) => c + 1)
      launchConfetti()
      setStatus({ text: '¡Foto enviada! 🎉', type: 'ok' })
      setMode('sent')
      setTimeout(resetToCamera, 2200)
    } catch {
      setStatus({ text: 'Error al enviar. Reintentá.', type: 'err' })
      setMode('preview')
    }
  }

  const resetToCamera = () => {
    setCapturedBlob(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setMode('camera')
    setStatus({ text: 'Enfocá y presioná el botón', type: '' })
  }

  const isPreview = mode === 'preview' || mode === 'sending' || mode === 'sent'
  const isBusy    = mode === 'sending' || timerCount !== null

  return (
    <div className={s.page}>
      <header className={s.header}>
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Top DJ Group" className={s.logo} />
        <div className={`${s.counter} ${sentCount > 0 ? s.pulse : ''}`}>
          {sentCount} foto{sentCount !== 1 ? 's' : ''} enviada{sentCount !== 1 ? 's' : ''}
        </div>
      </header>

      <div className={s.viewfinderWrap}>
        <div className={s.viewfinder}>
          <video
            ref={videoRef}
            className={s.video}
            style={{
              display: isPreview ? 'none' : 'block',
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
            }}
            autoPlay playsInline muted
          />
          {isPreview && previewUrl && (
            <img className={s.preview} src={previewUrl} alt="preview" />
          )}
          <div className={s.corners}>
            <div className={`${s.corner} ${s.tl}`} />
            <div className={`${s.corner} ${s.tr}`} />
            <div className={`${s.corner} ${s.bl}`} />
            <div className={`${s.corner} ${s.br}`} />
          </div>
          {showFlash && <div className={s.flash} />}
          {timerCount !== null && <div className={s.timerOverlay}>{timerCount}</div>}
          {cameraError && (
            <div className={s.noCam}>
              <span className={s.noCamIcon}>📵</span>
              <span>No se pudo acceder a la cámara.<br />Asegurate de dar permiso.</span>
            </div>
          )}
        </div>
      </div>

      <div className={s.controls}>
        <div className={s.shootRow}>
          <button
            className={`${s.btnIcon} ${timerDelay > 0 ? s.btnIconActive : ''}`}
            onClick={toggleTimer}
            title="Temporizador"
            disabled={isPreview}
          >
            {timerDelay === 0 ? '⏱' : `${timerDelay}s`}
          </button>
          <button className={s.shutter} onClick={capture} disabled={isBusy || isPreview}>
            <div className={s.shutterInner} />
          </button>
          <button className={s.btnIcon} onClick={flipCamera} title="Cambiar cámara" disabled={isPreview}>
            🔄
          </button>
        </div>

        {isPreview && (
          <div className={s.actionRow}>
            <button className={`${s.btn} ${s.btnSecondary}`} onClick={resetToCamera} disabled={isBusy}>
              ↩ Repetir
            </button>
            <button className={`${s.btn} ${s.btnPrimary}`} onClick={sendPhoto} disabled={isBusy}>
              {mode === 'sending' ? 'Enviando...' : '✉ Enviar'}
            </button>
          </div>
        )}

        <div className={`${s.status} ${s[status.type]}`}>{status.text}</div>
      </div>

      <footer className={s.footer}>
        <a href="https://www.instagram.com/topdjgroup/" target="_blank" rel="noreferrer" className={s.igLink}>
          📷 @topdjgroup
        </a>
        <span className={s.trademark}>Top DJ Group® · Marca registrada</span>
      </footer>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}
